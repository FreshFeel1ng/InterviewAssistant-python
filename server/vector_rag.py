"""
向量 RAG 示范模块

基于 BAAI/bge-m3 嵌入模型 + Milvus 向量数据库的语义检索。

与现有关键词匹配 RAG 的区别：
- 关键词匹配："高并发" 无法匹配 "QPS 8000"
- 向量检索："高并发" 能语义匹配 "QPS 8000"、"千万级请求"、"性能优化"

架构：
  简历文本 → 分块 → BGE-M3 嵌入 → Milvus 存储
  面试问题 → BGE-M3 嵌入 → Milvus 相似度检索 → Top-K 相关块

注意：这是示范代码，不影响现有关键词匹配逻辑。
"""
from typing import Optional

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_milvus import Milvus
from pymilvus import connections, utility

from server.config import config

# Milvus Collection 名称
COLLECTION_NAME = "resume_chunks"


class VectorRAG:
    """基于 Milvus 的向量检索 RAG"""

    def __init__(self):
        # 硅基流动的 BGE-M3 嵌入模型，兼容 OpenAI API 格式
        self.embeddings = OpenAIEmbeddings(
            model=config.embedding_model,  # BAAI/bge-m3
            api_key=config.siliconflow_api_key,
            base_url=config.siliconflow_base_url,
        )
        self._vector_store: Optional[Milvus] = None
        self._connected = False

    # ========== Milvus 连接管理 ==========

    def connect(self) -> bool:
        """连接 Milvus"""
        try:
            connections.connect(
                alias="default",
                host=config.milvus_host,
                port=config.milvus_port,
            )
            collections = utility.list_collections()
            print(f"[VectorRAG] Milvus 连接成功, 已有集合: {collections}")
            self._connected = True
            return True
        except Exception as e:
            print(f"[VectorRAG] Milvus 连接失败: {e}")
            print("[VectorRAG] 请确保 Docker Desktop 中 Milvus 已启动 (端口 19530)")
            return False

    def disconnect(self):
        """断开 Milvus 连接"""
        if self._connected:
            connections.disconnect("default")
            self._connected = False

    # ========== 向量存储 ==========

    def build_from_documents(self, documents: list[Document]) -> bool:
        """
        将简历分块向量化并存入 Milvus

        Args:
            documents: 简历分块列表（来自 ResumeKnowledgeBase._chunks）

        流程：
            每个 Document.page_content → BGE-M3 嵌入 → 1024维向量 → Milvus 存储
        """
        if not self._connected:
            print("[VectorRAG] 未连接 Milvus，跳过构建")
            return False

        if not documents:
            print("[VectorRAG] 文档列表为空")
            return False

        try:
            # 如果集合已存在，先删除重建（保证数据一致性）
            if utility.has_collection(COLLECTION_NAME):
                utility.drop_collection(COLLECTION_NAME)
                print(f"[VectorRAG] 已删除旧集合 {COLLECTION_NAME}")

            print(f"[VectorRAG] 开始向量化 {len(documents)} 个文档块...")

            # from_documents 内部会：
            # 1. 对每个 doc.page_content 调用 BGE-M3 生成 1024 维向量
            # 2. 创建 Milvus collection（自动建索引）
            # 3. 插入所有向量
            self._vector_store = Milvus.from_documents(
                documents=documents,
                embedding=self.embeddings,
                collection_name=COLLECTION_NAME,
                connection_args={
                    "host": config.milvus_host,
                    "port": config.milvus_port,
                },
                # Milvus 会自动创建 IVF_FLAT 或 HNSW 索引
                index_params={
                    "index_type": "HNSW",   # 图索引，检索速度快
                    "metric_type": "COSINE", # 余弦相似度
                    "params": {"M": 16, "efConstruction": 200},
                },
                drop_old=True,
            )

            print(f"[VectorRAG] 向量化完成, 集合: {COLLECTION_NAME}")
            return True

        except Exception as e:
            print(f"[VectorRAG] 构建失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    # ========== 语义检索 ==========

    def search(self, query: str, top_k: int = 3) -> list[Document]:
        """
        语义检索：将问题转为向量，在 Milvus 中找最相似的简历块

        Args:
            query: 面试官的问题
            top_k: 返回最相似的 K 个结果

        原理：
            1. BGE-M3(query) → 1024维向量
            2. Milvus HNSW 索引做近似最近邻搜索
            3. 返回余弦相似度最高的 K 个文档

        示例：
            query="你做过高并发项目吗"
            → 检索到: "订单系统优化，QPS从2000提升到8000"  (语义匹配!)
        """
        if not self._vector_store:
            # 如果 vector_store 还没构建，尝试从已有 collection 加载
            if self._connected and utility.has_collection(COLLECTION_NAME):
                print("[VectorRAG] 从已有集合加载...")
                self._vector_store = Milvus(
                    embedding_function=self.embeddings,
                    collection_name=COLLECTION_NAME,
                    connection_args={
                        "host": config.milvus_host,
                        "port": config.milvus_port,
                    },
                )
            else:
                print("[VectorRAG] 向量库未初始化，请先调用 build_from_documents")
                return []

        try:
            results = self._vector_store.similarity_search(query, k=top_k)
            print(f"[VectorRAG] 检索到 {len(results)} 个相关文档块")
            for i, doc in enumerate(results):
                preview = doc.page_content[:80].replace("\n", " ")
                print(f"  [{i+1}] {preview}...")
            return results
        except Exception as e:
            print(f"[VectorRAG] 检索失败: {e}")
            return []

    # ========== 对比测试 ==========

    @staticmethod
    def compare_search(keyword_results: list[Document], vector_results: list[Document]):
        """
        对比关键词匹配 vs 向量检索的结果

        帮助理解两种方法的差异
        """
        print("\n" + "=" * 60)
        print("检索结果对比")
        print("=" * 60)

        print(f"\n[关键词匹配] 返回 {len(keyword_results)} 个结果:")
        for i, doc in enumerate(keyword_results):
            print(f"  [{i+1}] {doc.page_content[:100]}...")

        print(f"\n[向量检索] 返回 {len(vector_results)} 个结果:")
        for i, doc in enumerate(vector_results):
            print(f"  [{i+1}] {doc.page_content[:100]}...")

        print("=" * 60)

    # ========== 状态查询 ==========

    def get_stats(self) -> dict:
        """获取向量库状态"""
        if not self._connected:
            return {"connected": False, "message": "Milvus 未连接"}

        try:
            if utility.has_collection(COLLECTION_NAME):
                from pymilvus import Collection
                col = Collection(COLLECTION_NAME)
                col.load()
                return {
                    "connected": True,
                    "collection": COLLECTION_NAME,
                    "num_entities": col.num_entities,
                    "index_type": "HNSW",
                    "metric_type": "COSINE",
                }
            return {"connected": True, "collection": None}
        except Exception as e:
            return {"connected": True, "error": str(e)}


# ========== 全局实例 ==========

vector_rag = VectorRAG()
