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
    """判断文本是否是一个完整的问题"""
    if not text or len(text) < 5:
        return False

    interview_keywords = [
        "请", "说说", "谈谈", "介绍", "解释", "描述", "分析", "讲一下",
        "怎么看", "怎么理解", "怎么处理", "怎么做", "如何", "什么是",
        "please", "tell", "explain", "describe", "what", "how", "why",
    ]

    has_question_mark = bool(re.search(r"[？?吗呢吧啊呀]$", text))
    has_keyword = any(kw in text.lower() for kw in interview_keywords)

    return has_question_mark or has_keyword


def extract_question(text: str) -> str:
    """从长文本中提取面试问题"""
    sentences = [s.strip() for s in re.split(r"[。！.!\n]+", text) if s.strip()]
    for sentence in reversed(sentences):
        if is_complete_question(sentence):
            return sentence
    return max(sentences, key=len, default="").strip()
