"""
语音文本预处理
"""
import re


def preprocess_transcript(raw: str) -> str:
    """清理和规范化识别结果"""
    text = raw.strip()
    text = re.sub(r"[，,。.！!？?]{2,}", lambda m: m.group()[0], text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def is_complete_question(text: str) -> bool:
    """判断文本是否是一个完整的问题

    采用多层判断策略：
    1. 问句标记（问号、疑问语气词）
    2. 面试提问关键词
    3. 常见面试主题词 + 足够长的文本（兜底策略，应对语音识别偏差）
    """
    if not text or len(text) < 5:
        return False

    lower = text.lower()

    # 第1层：问句标记
    question_markers = r"[？?吗呢吧啊呀]"
    if re.search(question_markers, text):
        return True

    # 第2层：面试提问关键词
    interview_keywords = [
        # 祈使/请求
        "请", "麻烦", "能", "可以",
        # 阐述类
        "说说", "说一说", "谈谈", "讲一讲", "讲讲", "介绍", "解释", "描述",
        "分析", "讲一下", "说一下", "聊一聊", "聊聊", "阐述", "概述",
        # 询问观点
        "怎么看", "怎么理解", "怎么处理", "怎么做", "怎么办", "如何",
        "什么是", "为什么", "能说一下", "能讲讲", "能介绍",
        # 追问
        "具体", "详细", "展开", "深入", "还有", "继续", "然后",
        # 假设/场景
        "如果", "假如", "假设", "比如", "例如", "举个例子",
        # 对比/选择
        "区别", "区别是什么", "优缺点", "优劣", "哪个好", "选哪个",
        # 经验类
        "做过", "用过", "经历", "遇到", "处理过", "负责",
        # 定义/概念
        "定义", "概念", "含义", "指的是",
        # 英文
        "please", "tell", "explain", "describe", "what", "how", "why",
        "could you", "can you", "would you",
    ]
    if any(kw in lower for kw in interview_keywords):
        return True

    # 第3层：兜底策略 - 包含面试主题词且文本足够长
    # 语音识别可能把"索引"识别成"所以"、"mysql"识别成"my circle"等
    # 只要文本长度足够且包含常见技术/面试词汇，就当作问题处理
    topic_keywords = [
        # 技术概念（常见面试话题）
        "索引", "数据库", "缓存", "算法", "数据结构", "设计模式",
        "架构", "微服务", "分布式", "高并发", "多线程", "进程",
        "内存", "性能", "优化", "安全", "加密", "网络", "协议",
        "http", "tcp", "api", "rest", "sql", "nosql", "redis",
        "docker", "k8s", "linux", "git", "框架", "编程", "开发",
        "测试", "部署", "运维", "前端", "后端", "全栈",
        # 项目/经验类
        "项目", "经验", "工作", "实习", "团队", "管理",
        "领导", "沟通", "协作", "交付", "上线",
        # 职业发展
        "职业", "规划", "发展", "目标", "未来", "方向",
        # 通用面试词
        "面试", "岗位", "职位", "公司", "业务", "技术栈",
    ]

    # 匹配到主题词 且 文本长度 >= 8（语音识别偏差时通常也有一定长度）
    if len(text) >= 8 and any(kw in lower for kw in topic_keywords):
        return True

    # 第4层：纯长度兜底 - 如果文本超过20字，很可能是面试官在说一段话
    if len(text) >= 20:
        return True

    return False


def extract_question(text: str) -> str:
    """从长文本中提取面试问题"""
    sentences = [s.strip() for s in re.split(r"[。！.!\n]+", text) if s.strip()]
    for sentence in reversed(sentences):
        if is_complete_question(sentence):
            return sentence
    return max(sentences, key=len, default="").strip()
