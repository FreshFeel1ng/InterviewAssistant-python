"""
面试助手核心 Agent

基于 LangChain + DeepSeek，生成既专业又口语化的面试回答
"""
from typing import AsyncGenerator, Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableSequence
from langchain_core.messages import HumanMessage, AIMessage

from server.config import config
from server.classifier import classify_question, get_answer_strategy
from server.resume import ResumeKnowledgeBase

SYSTEM_PROMPT_TEMPLATE = """你是一个专业的面试辅助 AI。你的任务是帮助正在面试的候选人，针对面试官的问题生成自然、专业且口语化的回答。

## 核心原则
1. **口语化优先**：回答必须像真人说话，使用自然的停顿、语气词（嗯、其实、我觉得等），避免书面语和过于正式的表达
2. **专业性保证**：内容要准确、有深度，展现扎实的专业功底
3. **长度适中**：回答控制在 100-250 字之间，不要太长显得像背书
4. **自然节奏**：可以适当加入思考性的停顿词，模拟真实思考过程
5. **针对性回答**：根据面试类型和候选人背景，量身定制回答风格

## 面试信息
- 面试类型：{interviewType}
- 候选人背景：{candidateBackground}
- 使用语言：{language}

## 回答风格要求
- 使用第一人称"我"
- 加入自然的填充词：嗯、我觉得、其实、怎么说呢
- 适当展示思考过程："这个问题可以从几个角度来考虑..."
- 避免完美无瑕的回答，适当展现真实工作中的权衡和取舍
- 如果问题涉及不会的内容，坦诚表达但展示学习能力

## 回答结构建议
1. 先用 1-2 句话直接回应问题核心
2. 展开 2-3 个关键点，用口语化方式表达
3. **优先结合候选人的真实项目经历**来回答，让回答更具体可信
4. 结尾简短总结

## 候选人的真实项目经历（简历内容）
{resumeContext}

## 当前问题的分析
- 问题类别：{questionCategory}
- 回答策略建议：{answerStrategy}

记住：你的目标不是给一个完美的书面答案，而是帮候选人说出一个面试官会觉得是"现场思考出来的好回答"。
**特别重要**：如果上面有候选人的项目经历，一定要结合具体项目来回答。比如"在我之前做的XX项目中，我负责了..."这样会让回答更真实可信。"""


class InterviewAgent:
    """面试助手 Agent"""

    def __init__(self):
        self.llm = ChatOpenAI(
            model=config.llm_model,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            api_key=config.deepseek_api_key,
            base_url=config.deepseek_base_url,
        )
        # 用简单的列表存储对话历史
        self.chat_history: list = []
        # 简历知识库（由 session 注入）
        self.resume_kb: ResumeKnowledgeBase | None = None

        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_TEMPLATE),
            MessagesPlaceholder("chat_history"),
            ("human", "面试官刚才问了这个问题，请帮我生成一个自然的回答：\n{question}"),
        ])

        self.chain = prompt | self.llm | StrOutputParser()

    async def generate_answer(
        self,
        question: str,
        interview_type: str = "技术面试",
        candidate_background: str = "全栈开发工程师",
        language: str = "zh",
    ) -> str:
        """生成面试回答"""
        classification = classify_question(question)

        # 检索简历相关上下文
        resume_context = ""
        if self.resume_kb:
            resume_context = self.resume_kb.get_context_for_question(question)

        response = await self.chain.ainvoke({
            "question": question,
            "chat_history": self.chat_history,
            "interviewType": interview_type,
            "candidateBackground": candidate_background,
            "language": language,
            "questionCategory": classification.category.value,
            "answerStrategy": get_answer_strategy(classification.category),
            "resumeContext": resume_context if resume_context else "暂无候选人简历信息，请根据通用知识回答。",
        })

        # 保存到历史
        self.chat_history.append(HumanMessage(content=question))
        self.chat_history.append(AIMessage(content=response))

        return response

    async def generate_answer_stream(
        self,
        question: str,
        interview_type: str = "技术面试",
        candidate_background: str = "全栈开发工程师",
        language: str = "zh",
    ) -> AsyncGenerator[str, None]:
        """流式生成面试回答"""
        streaming_llm = ChatOpenAI(
            model=config.llm_model,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            api_key=config.deepseek_api_key,
            base_url=config.deepseek_base_url,
            streaming=True,
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_TEMPLATE),
            MessagesPlaceholder("chat_history"),
            ("human", "面试官刚才问了这个问题，请帮我生成一个自然的回答：\n{question}"),
        ])

        chain = prompt | streaming_llm | StrOutputParser()

        classification = classify_question(question)

        # 检索简历相关上下文
        resume_context = ""
        if self.resume_kb:
            resume_context = self.resume_kb.get_context_for_question(question)

        full_response = ""
        async for chunk in chain.astream({
            "question": question,
            "chat_history": self.chat_history,
            "interviewType": interview_type,
            "candidateBackground": candidate_background,
            "language": language,
            "questionCategory": classification.category.value,
            "answerStrategy": get_answer_strategy(classification.category),
            "resumeContext": resume_context if resume_context else "暂无候选人简历信息，请根据通用知识回答。",
        }):
            full_response += chunk
            yield chunk

        # 保存到历史
        self.chat_history.append(HumanMessage(content=question))
        self.chat_history.append(AIMessage(content=full_response))

    def clear_memory(self):
        self.chat_history.clear()
