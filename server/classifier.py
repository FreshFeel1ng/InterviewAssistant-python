"""
面试问题分类器

自动识别面试官问题的类型，以便 Agent 采用不同的回答策略
"""
from enum import Enum
from dataclasses import dataclass, field


class QuestionCategory(str, Enum):
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    SYSTEM_DESIGN = "system_design"
    CODING = "coding"
    PROJECT_EXPERIENCE = "project"
    CAREER_GOAL = "career"
    SALARY = "salary"
    GENERAL = "general"
    FOLLOW_UP = "follow_up"


@dataclass
class ClassificationResult:
    category: QuestionCategory
    confidence: float
    sub_categories: list = field(default_factory=list)


CATEGORY_RULES = [
    {
        "category": QuestionCategory.TECHNICAL,
        "keywords": [
            "原理", "底层", "实现", "源码", "架构", "机制", "区别",
            "优化", "性能", "原理是什么", "怎么实现", "如何工作",
            "architecture", "principle", "implementation", "mechanism",
            "difference", "optimization", "performance",
        ],
    },
    {
        "category": QuestionCategory.BEHAVIORAL,
        "keywords": [
            "遇到", "处理", "解决", "冲突", "困难", "挑战", "失败",
            "团队", "沟通", "领导", "说服", "压力", "矛盾",
            "handle", "deal with", "conflict", "challenge", "failure",
            "team", "communication", "leadership", "persuade",
        ],
    },
    {
        "category": QuestionCategory.SYSTEM_DESIGN,
        "keywords": [
            "设计", "系统", "架构", "扩展", "高并发", "分布式",
            "微服务", "数据库设计", "API设计", "扩容",
            "design", "system", "architecture", "scalable", "distributed",
        ],
    },
    {
        "category": QuestionCategory.CODING,
        "keywords": [
            "写", "实现", "算法", "代码", "函数", "排序", "遍历",
            "write", "implement", "algorithm", "code", "function",
            "leetcode", "复杂度",
        ],
    },
    {
        "category": QuestionCategory.PROJECT_EXPERIENCE,
        "keywords": [
            "项目", "经验", "做过", "参与", "负责", "上线", "成果",
            "project", "experience", "built", "developed", "launched",
        ],
    },
    {
        "category": QuestionCategory.CAREER_GOAL,
        "keywords": [
            "规划", "目标", "发展", "方向", "未来", "五年", "三年",
            "career", "goal", "plan", "future",
        ],
    },
    {
        "category": QuestionCategory.SALARY,
        "keywords": [
            "薪资", "工资", "期望", "待遇", "薪酬",
            "salary", "compensation", "expectation",
        ],
    },
    {
        "category": QuestionCategory.FOLLOW_UP,
        "keywords": [
            "具体", "详细", "举例", "深入", "还有呢", "继续",
            "specifically", "elaborate", "example", "detail",
        ],
    },
]

ANSWER_STRATEGIES = {
    QuestionCategory.TECHNICAL: "先给出核心概念，再深入原理，最后结合实际应用场景。展现你对技术的理解深度。",
    QuestionCategory.BEHAVIORAL: "用 STAR 法则（情境-任务-行动-结果）组织回答。强调你在其中的角色和贡献，展示软技能。",
    QuestionCategory.SYSTEM_DESIGN: "从需求分析开始，逐步展开架构设计。讨论 trade-off，展示工程思维和全局观。",
    QuestionCategory.CODING: "先说思路和复杂度分析，再讲实现。强调代码的可读性和边界条件处理。",
    QuestionCategory.PROJECT_EXPERIENCE: "突出你的贡献和影响，用具体数据说明成果。讲清楚技术挑战和解决方案。",
    QuestionCategory.CAREER_GOAL: "展示清晰的职业规划和对行业的思考。结合公司的发展方向，表达共同成长的意愿。",
    QuestionCategory.SALARY: "表达对机会的重视，给出合理范围并说明依据。留出谈判空间。",
    QuestionCategory.GENERAL: "真诚表达，展示你的思考过程和价值观。",
    QuestionCategory.FOLLOW_UP: "在之前的回答基础上深入，补充具体细节和例子。保持逻辑一致性。",
}


def classify_question(question: str) -> ClassificationResult:
    """分类面试问题"""
    lower_q = question.lower()
    scores = []

    for rule in CATEGORY_RULES:
        score = sum(1 for kw in rule["keywords"] if kw in lower_q)
        if score > 0:
            scores.append((rule["category"], score))

    scores.sort(key=lambda x: x[1], reverse=True)

    if not scores:
        return ClassificationResult(category=QuestionCategory.GENERAL, confidence=0.3)

    top = scores[0]
    max_score = max(s[1] for s in scores)
    confidence = min(top[1] / (max_score + 1), 0.95)

    return ClassificationResult(
        category=top[0],
        confidence=confidence,
        sub_categories=[(s[0], s[1]) for s in scores[:3]],
    )


def get_answer_strategy(category: QuestionCategory) -> str:
    return ANSWER_STRATEGIES.get(category, ANSWER_STRATEGIES[QuestionCategory.GENERAL])
