"""
回答人性化后处理器

对 AI 生成的回答进行后处理，使其更加自然、口语化
"""
import random
import re

CN_FILLERS = ["嗯，", "呃，", "其实吧，", "怎么说呢，", "我想想啊，", "这个问题的话，", "我觉得吧，"]
EN_FILLERS = ["Well, ", "Hmm, ", "Let me think... ", "I'd say, ", "You know, ", "Actually, "]

CN_FORMAL_REPLACEMENTS = [
    (re.compile(r"综上所述"), "总的来说"),
    (re.compile(r"因此"), "所以"),
    (re.compile(r"此外"), "还有"),
    (re.compile(r"然而"), "但是"),
    (re.compile(r"首先"), "第一点"),
    (re.compile(r"其次"), "另外"),
    (re.compile(r"最后"), "最后呢"),
    (re.compile(r"显著"), "很明显"),
    (re.compile(r"优化"), "改进"),
    (re.compile(r"实现"), "做出来"),
    (re.compile(r"进行"), "做"),
    (re.compile(r"确保"), "保证"),
]

EN_FORMAL_REPLACEMENTS = [
    (re.compile(r"therefore", re.I), "so"),
    (re.compile(r"furthermore", re.I), "also"),
    (re.compile(r"however", re.I), "but"),
    (re.compile(r"implement", re.I), "build"),
    (re.compile(r"utilize", re.I), "use"),
    (re.compile(r"optimize", re.I), "improve"),
    (re.compile(r"significant", re.I), "big"),
]


def humanize_answer(answer: str, language: str = "zh") -> str:
    """让 AI 回答更像真人说话"""
    if language == "zh":
        return _humanize_chinese(answer)
    return _humanize_english(answer)


def _humanize_chinese(text: str) -> str:
    result = text

    # 替换过于书面化的词汇
    for pattern, replacement in CN_FORMAL_REPLACEMENTS:
        result = pattern.sub(replacement, result)

    # 句首添加填充词（约 30% 概率）
    if len(result) > 20 and random.random() > 0.7:
        filler = random.choice(CN_FILLERS)
        for f in CN_FILLERS:
            if result.startswith(f):
                result = result[len(f):]
                break
        result = filler + result

    # 偶尔加入自我修正（约 15% 概率）
    if random.random() > 0.85 and len(result) > 40:
        mid = int(len(result) * (0.3 + random.random() * 0.4))
        corrections = ["——或者说，", "——不对，应该说，", "——嗯，更准确地说，"]
        correction = random.choice(corrections)
        result = result[:mid] + correction + result[mid:]

    return result


def _humanize_english(text: str) -> str:
    result = text

    for pattern, replacement in EN_FORMAL_REPLACEMENTS:
        result = pattern.sub(replacement, result)

    if len(result) > 20 and random.random() > 0.7:
        filler = random.choice(EN_FILLERS)
        for f in EN_FILLERS:
            if result.startswith(f):
                result = result[len(f):]
                break
        result = filler + result

    # 使用缩写
    result = result.replace("it is", "it's").replace("that is", "that's")
    result = result.replace("I am", "I'm").replace("we are", "we're")
    result = result.replace("do not", "don't").replace("does not", "doesn't")
    result = result.replace("cannot", "can't").replace("will not", "won't")

    return result
