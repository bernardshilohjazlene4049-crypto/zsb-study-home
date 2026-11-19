# 高数第一章讲义照片 p01–p07 逐字转写（以照片为准）。
# 行 = (正文, 手写旁注)。正文/旁注中 $...$ 是公式（构建时转成 MathML），□ 是讲义里的方框占位符。
# 手写内容原样转写，看不清的位置写【看不清】；红线、圈、星、括号等纯标记不转写，见「打开原图」。
# kind: "p" 正文行；"title" 小节标题行；"tree" 缩进树（正文里用 "\n" 分行，行首 "-" 的个数表示层级）。

POINTS = {
 1: {"entries": [
  {"id": "gs1-1-1", "title": "求函数的定义域", "photos": [1], "rows": [
    ("title", "第一节 函数", None),
    ("title", "考点一：求函数的定义域", None),
    ("p", r"(1) $\frac{1}{□}$，$□\neq 0$", None),
    ("p", r"(2) $\sqrt[2n]{□}$，$□\geq 0$（$n=1,2,3\ldots$）　　$\sqrt[2n+1]{□}$，$□\in(-\infty,+\infty)$（$n=1,2,3\ldots$）", None),
    ("p", r"(3) $\log_a□$（如 $\ln□$ 或 $\lg□$），$□>0$", None),
    ("p", r"(4) $\arcsin□$ 或 $\arccos□$，$□\in[-1,1]$ 或 $|□|\leq 1$", None),
  ]},
  {"id": "gs1-1-2", "title": "专项练习 第一章 考点一：求函数的定义域", "photos": [7], "rows": [
    ("title", "专项练习 第一章", None),
    ("title", "考点一：求函数的定义域", None),
    ("p", r"1、函数 $f(x)=\frac{\ln|x|}{\sqrt{1-x^2}}$ 的定义域是 ＿＿＿＿", r"手写：$(-1,0)\cup(0,1)$"),
    ("p", "", "手写：1.初等函数（1或多）：取交集"),
    ("p", "", "手写：2.分段函数（【看不清】）：同一行取交集，不同的取并集"),
    ("p", "", "手写：3.抽象函数：f( )和f( )中( )范围相同"),
    ("p", "", r"手写（下沿被截断）：【看不清】　$x^2$【看不清】0　→　$x^2<1$　→　$-1<x<1$　　$x^2=1$"),
  ]},
 ]},
 2: {"entries": [
  {"id": "gs1-2-1", "title": "一、单调性", "photos": [1], "rows": [
    ("title", "考点二：函数的性质", None),
    ("p", "一、单调性：", None),
  ]},
  {"id": "gs1-2-2", "title": "二、奇偶性", "photos": [1], "rows": [
    ("p", "二、奇偶性：", None),
    ("p", r"设函数 $f(x)$ 的定义域 $D$ 关于原点对称，如果对于任意的 $x\in D$，", None),
    ("p", r"(1) 恒有 $f(-x)=-f(x)$ 或 $f(-x)+f(x)=0$，则称 $f(x)$ 为奇函数（图像关于原点对称）", None),
    ("p", r"(2) 恒有 $f(-x)=f(x)$，则称 $f(x)$ 为偶函数（图像关于 $y$ 轴对称）", None),
    ("p", "既不是奇函数也不是偶函数的函数，称为非奇非偶函数", r"手写：$a^x$，$\log_a x$"),
    ("p", r"常见的奇函数：$x^{2n+1}$，$\sin x$，$\tan x$，$\cot x$，$\csc x$，$\arcsin x$，$\arctan x$", None),
    ("p", r"常见的偶函数：$x^{2n}$，$\cos x$，$\sec x$，$|x|$，$C$（常数）", r"手写：$\sec x=\frac{1}{\cos x}$"),
    ("p", "运算性质：奇±奇=奇　偶±偶=偶　奇±偶=非奇非偶", None),
    ("p", "奇×÷奇=偶　偶×÷偶=偶　奇×÷偶=奇", None),
    ("p", "复合函数：内奇同外　内偶则偶", None),
  ]},
  {"id": "gs1-2-3", "title": "三、周期性", "photos": [1], "rows": [
    ("p", "三、周期性：", None),
    ("p", r"(1) $y=A\sin(\omega x+\varphi)+B$ 的周期 $T=\frac{2\pi}{|\omega|}$", None),
    ("p", r"(2) $y=A\cos(\omega x+\varphi)+B$ 的周期 $T=\frac{2\pi}{|\omega|}$", None),
    ("p", r"(3) $y=A\tan(\omega x+\varphi)+B$ 的周期 $T=\frac{\pi}{|\omega|}$", None),
    ("p", r"(4) $y=A\cot(\omega x+\varphi)+B$ 的周期 $T=\frac{\pi}{|\omega|}$", None),
  ]},
  {"id": "gs1-2-4", "title": "四、有界性", "photos": [1], "rows": [
    ("p", "四、有界性：", None),
    ("p", r"常考有界函数 $\sin x$，$\cos x$，$\arcsin x$，$\arccos x$，$\arctan x$，$\operatorname{arccot}x$。", None),
  ]},
 ]},
 3: {"entries": [
  {"id": "gs1-3-1", "title": "一、收敛数列的性质", "photos": [2], "rows": [
    ("title", "第二节 极限", None),
    ("title", "考点三：数列极限", None),
    ("p", "一、收敛数列的性质：", None),
    ("p", r"1、唯一性：若数列 $\{x_n\}$ 收敛，则数列 $\{x_n\}$ 极限唯一，即", None),
    ("p", r"$\lim_{n\to\infty}x_n=a,\ \lim_{n\to\infty}x_n=b\Rightarrow a=b$", None),
    ("p", r"2、有界性：若数列 $\{x_n\}$ 收敛，则数列 $\{x_n\}$ 一定有界，反之不成立。", "手写：收敛 ⇄ 有界（去一）（有范围）；无界 ⇄ 发散（无范围）（【看不清】）"),
    ("p", "注：有界数列不一定有极限，无界数列一定无极限。", None),
  ]},
  {"id": "gs1-3-2", "title": "二、数列极限的四则运算法则", "photos": [2], "rows": [
    ("p", "二、数列极限的四则运算法则：", None),
    ("p", r"设 $\lim_{n\to\infty}x_n=A,\ \lim_{n\to\infty}y_n=B$，则", None),
    ("p", r"(1) $\lim_{n\to\infty}(x_n\pm y_n)=A\pm B$", "手写：每个极限都存在（能算出数），才可以分开算"),
    ("p", r"(2) $\lim_{n\to\infty}(x_n\cdot y_n)=A\cdot B$", None),
    ("p", r"(3) $\lim_{n\to\infty}\left(\frac{x_n}{y_n}\right)=\frac{A}{B}\ (B\neq 0)$", None),
  ]},
 ]},
 4: {"entries": [
  {"id": "gs1-4-1", "title": "一、x→x₀ 时的函数极限", "photos": [2, 3], "rows": [
    ("title", "考点四：函数极限", None),
    ("p", r"一、$x\to x_0$ 时的函数极限：", None),
    ("p", r"1、定理：$\lim_{x\to x_0}f(x)=\mathrm{A}\Leftrightarrow\lim_{x\to x_0^-}f(x)=\lim_{x\to x_0^+}f(x)=\mathrm{A}$（左极限　右极限）", r"手写：$x_0$ 左右不同时，需求左极限，右极限"),
    ("p", r"注：极限 $\lim_{x\to x_0}f(x)$ 是否存在，与函数 $f(x)$ 在点 $x_0$ 处有无定义以及 $f(x_0)$ 取什么值没有关系。", None),
    ("p", r"2、极限的性质：如果函数极限 $\lim_{x\to x_0}f(x)$ 存在，则极限值唯一", None),
    ("p", "3、函数极限的四则运算法则：", "手写：同数列极限的四则运算法则"),
    ("p", r"设 $\lim_{x\to x_0}f(x)=\mathrm{A},\ \lim_{x\to x_0}g(x)=\mathrm{B}$（均存在），则", None),
    ("p", r"(1) $\lim_{x\to x_0}[f(x)\pm g(x)]=\lim_{x\to x_0}f(x)\pm\lim_{x\to x_0}g(x)=\mathrm{A}\pm\mathrm{B}$", None),
    ("p", r"(2) $\lim_{x\to x_0}[f(x)\cdot g(x)]=\lim_{x\to x_0}f(x)\cdot\lim_{x\to x_0}g(x)=\mathrm{A}\cdot\mathrm{B}$", None),
    ("p", r"$\lim_{x\to x_0}[Cf(x)]=C\lim_{x\to x_0}f(x)=C\mathrm{A}$", None),
    ("p", r"$\lim_{x\to x_0}f^n(x)=\left[\lim_{x\to x_0}f(x)\right]^n=\mathrm{A}^n$", None),
    ("p", r"(3) $\lim_{x\to x_0}\frac{f(x)}{g(x)}=\frac{\lim_{x\to x_0}f(x)}{\lim_{x\to x_0}g(x)}=\frac{\mathrm{A}}{\mathrm{B}}\quad(\mathrm{B}\neq 0)$", None),
    ("p", r"注：当 $x\to x_0$ 变为 $x\to x_0^+,x\to x_0^-,x\to\infty,x\to+\infty,x\to-\infty$ 时，上述结论也成立。", r"手写：$\operatorname{arccot}(+\infty)=0$，$\operatorname{arccot}(-\infty)=\pi$（旁有 $y=\operatorname{arccot}x$ 的图）"),
  ]},
  {"id": "gs1-4-2", "title": "二、x→∞ 时的函数极限", "photos": [3], "rows": [
    ("p", r"二、$x\to\infty$ 时的函数极限：", None),
    ("p", r"定理：$\lim_{x\to\infty}f(x)=\mathrm{A}\Leftrightarrow\lim_{x\to-\infty}f(x)=\lim_{x\to+\infty}f(x)=\mathrm{A}$", r"手写：$\arctan(+\infty)=\frac{\pi}{2}$，$\arctan(-\infty)=-\frac{\pi}{2}$（旁有 $y=\arctan x$ 的图）"),
    ("p", "总结：", "手写：记结论：$\\frac{1}{0^+}=+\\infty$，$\\frac{1}{0^-}=-\\infty$（旁有 $y=\\frac{1}{x}$ 的图）"),
    ("p", "", r"手写：$e^{+\infty}=+\infty$，$e^{-\infty}=0$（旁有 $y=e^x$ 的图）"),
    ("p", r"$\lim_{x\to\infty}\dfrac{a_nx^n+\cdots+a_1x+a_0}{b_mx^m+\cdots+b_1x+b_0}\overset{\infty/\infty}{=}\begin{cases}\frac{a_n}{b_m}, & n=m\\ 0, & n<m\\ \infty, & n>m\end{cases}$", "手写：同大为系数比；下大为0；上大为∞"),
    ("p", "", r"手写：$\ln(+\infty)=+\infty$，$\ln 0^+=-\infty$（旁有 $y=\ln x$ 的图）"),
  ]},
 ]},
 5: {"entries": [
  {"id": "gs1-5-1", "title": "一、无穷小的定义", "photos": [3], "rows": [
    ("title", "考点五：无穷小与无穷大", None),
    ("p", "一、无穷小的定义：极限为零的函数称为无穷小量，简称无穷小", None),
  ]},
  {"id": "gs1-5-2", "title": "二、无穷小的性质", "photos": [3], "rows": [
    ("p", "二、无穷小的性质：", None),
    ("p", "性质 1：有限个无穷小的和、差、积仍为无穷小", None),
    ("p", "性质 2：有界函数与无穷小乘积为无穷小", r"手写：$0\times$有界$=0$"),
    ("p", "推论：常数与无穷小乘积为无穷小", None),
  ]},
  {"id": "gs1-5-3", "title": "三、无穷大定义", "photos": [3], "rows": [
    ("p", "三、无穷大定义：极限为无穷的函数称为无穷大量，简称无穷大", None),
  ]},
  {"id": "gs1-5-4", "title": "四、无穷大与无穷小关系", "photos": [3], "rows": [
    ("p", "四、无穷大与无穷小关系：（倒数关系）", None),
  ]},
 ]},
 6: {"entries": [
  {"id": "gs1-6-1", "title": "无穷小的比较", "photos": [3], "rows": [
    ("title", "考点六：无穷小的比较", None),
    ("p", r"设 $\lim_{x\to□}f(x)=0,\ \lim_{x\to□}g(x)=0$，且 $g(x)\neq 0$，若", None),
    ("p", r"(1) $\lim_{x\to□}\frac{f(x)}{g(x)}=0$，则 $f(x)$ 是比 $g(x)$ 高阶的无穷小；", None),
    ("p", r"(2) $\lim_{x\to□}\frac{f(x)}{g(x)}=\infty$，则 $f(x)$ 是比 $g(x)$ 低阶的无穷小；", None),
    ("p", r"(3) $\lim_{x\to□}\frac{f(x)}{g(x)}=c\,(c\neq 0,c\neq 1)$，则 $f(x)$ 与 $g(x)$ 是同阶无穷小；", None),
    ("p", r"(4) $\lim_{x\to□}\frac{f(x)}{g(x)}=1$，则 $f(x)$ 与 $g(x)$ 是等价无穷小，记作 $f(x)\sim g(x)$。", None),
    ("p", r"注：$x\to□$ 包含 $x\to x_0,x\to x_0^+,x\to x_0^-,x\to\infty,x\to+\infty,x\to-\infty$", None),
  ]},
  {"id": "gs1-6-2", "title": "八个等价替换", "photos": [4], "rows": [
    ("p", r"八个等价替换：$x\to 0$ 时，", None),
    ("p", r"$\sin x\sim x$", None),
    ("p", r"$\tan x\sim x$", None),
    ("p", r"$\arcsin x\sim x$", None),
    ("p", r"$\arctan x\sim x$", None),
    ("p", r"$e^x-1\sim x$", None),
    ("p", r"$\ln(1+x)\sim x$", None),
    ("p", r"$1-\cos x\sim\frac{1}{2}x^2$", None),
    ("p", r"$(1+x)^m-1\sim mx$", None),
    ("p", r"补充：$a^x-1\sim x\ln a\,(a>0,a\neq 1)$，$\sec x-1\sim\frac{1}{2}x^2$", None),
  ]},
  {"id": "gs1-6-3", "title": "等价无穷小大小数轴", "photos": [4], "rows": [
    ("p", r"一格相差 $\frac{1}{2}x^2$：小 ——ln(1+x)—— x ——e^x−1—— 大", None),
    ("p", r"$x-\ln(1+x)\sim\frac{1}{2}x^2;\ e^x-1-x\sim\frac{1}{2}x^2;\ e^x-1-\ln(1+x)\sim x^2$", None),
    ("p", r"一格相差 $\frac{1}{6}x^3$：小 ——arctanx—— sinx —— x —— arcsinx —— tanx—— 大", "数轴下方有几处很浅的小字【看不清】"),
    ("p", r"$x-\sin x\sim\frac{1}{6}x^3;\ \arcsin x-x\sim\frac{1}{6}x^3;\ \tan x-x\sim\frac{1}{3}x^3$", None),
  ]},
 ]},
 7: {"entries": [
  {"id": "gs1-7-1", "title": "一、第一个重要极限", "photos": [4], "rows": [
    ("title", "考点七：两个重要极限", None),
    ("p", "一、第一个重要极限：“$\\frac{0}{0}$”型", None),
    ("p", r"$\lim_{x\to 0}\frac{\sin x}{x}=1$　　注意：$\lim_{x\to\infty}\frac{\sin x}{x}=0$", None),
    ("p", r"推广：$\lim_{□\to 0}\frac{\sin□}{□}=1$", None),
  ]},
  {"id": "gs1-7-2", "title": "二、第二个重要极限", "photos": [4], "rows": [
    ("p", "二、第二个重要极限：“$1^\\infty$”型", r"手写：$\lim[1+f(x)]^{g(x)}\ (1^\infty)=e^{\lim f(x)\cdot g(x)}$"),
    ("p", r"$\lim_{x\to\infty}\left(1+\frac{1}{x}\right)^x=e(\approx 2.72)$　　$\lim_{x\to 0}(1+x)^{\frac{1}{x}}=e$", None),
    ("p", r"推广：$\lim_{□\to\infty}\left(1+\frac{1}{□}\right)^{□}=e$　　$\lim_{□\to 0}(1+□)^{\frac{1}{□}}=e$", None),
  ]},
 ]},
 8: {"entries": [
  {"id": "gs1-8-1", "title": "一、渐近线的分类", "photos": [5], "rows": [
    ("title", "考点八：函数的渐近线", None),
    ("p", "一、渐近线的分类", None),
    ("p", r"1、水平渐近线", None),
    ("p", r"如果 $\lim_{x\to\infty}f(x)=b$（$x\to+\infty$ 或 $x\to-\infty$），则直线 $y=b$ 就是曲线 $y=f(x)$ 的水平渐近线。", None),
    ("p", "2、垂直渐近线", None),
    ("p", r"如果 $\lim f(x)=\infty$（$x\to x_0^+$ 或 $x\to x_0^-$），那么直线 $x=x_0$ 就是曲线 $y=f(x)$ 的垂直渐近线（或铅直渐近线）。", None),
  ]},
  {"id": "gs1-8-2", "title": "二、如何找渐近线", "photos": [5], "rows": [
    ("p", "二、如何找渐近线", None),
    ("p", r"1、找函数无定义的点 $x_0$，判断 $\lim_{x\to x_0}f(x)$ 是否为 $\infty$，若等于 $\infty$，则 $x=x_0$ 为垂直渐近线。", r"手写：单独的 $\lim_{x\to x_0^-}f(x)=\infty$ 或 $\lim_{x\to x_0^+}=\infty\Rightarrow x=x_0$ 为垂直渐近线"),
    ("p", r"2、判断 $\lim_{x\to\infty}f(x)$（$x\to+\infty$ 或 $x\to-\infty$）是否等于常数 $b$，若等于 $b$，则 $y=b$ 为水平渐近线。", r"手写：单独的 $\lim_{x\to+\infty}f(x)=b$ 或 $\lim_{x\to-\infty}f(x)=b\Rightarrow y=b$ 为水平渐近线"),
    ("p", "", r"手写：若 $\lim_{x\to+\infty}f(x)=a$，$\lim_{x\to-\infty}f(x)=b\Rightarrow y=a,\ y=b$ 均为水平渐近线"),
  ]},
 ]},
 9: {"entries": [
  {"id": "gs1-9-1", "title": "函数连续的定义", "photos": [5], "rows": [
    ("title", "第三节 连续", None),
    ("title", "考点九：函数的连续性", None),
    ("p", "函数连续的定义：", None),
    ("p", r"设函数 $f(x)$ 在点 $x_0$ 的某一邻域内有定义，如果 $\lim_{x\to x_0}f(x)=f(x_0)$，那么就称函数 $f(x)$ 在点 $x_0$ 处连续。", None),
    ("p", r"注：$f(x)$ 在 $x_0$ 处连续必须同时满足的三个要素：", None),
    ("p", r"(1) $f(x)$ 在点 $x_0$ 的某一邻域内有定义", None),
    ("p", r"(2) $\lim_{x\to x_0}f(x)$ 存在", None),
    ("p", r"(3) $\lim_{x\to x_0}f(x)=f(x_0)$", None),
  ]},
  {"id": "gs1-9-2", "title": "左连续与右连续定义", "photos": [5], "rows": [
    ("p", "左连续与右连续定义：", None),
    ("p", r"若函数 $f(x)$ 在点 $x_0$ 的左侧邻域内有定义，且 $\lim_{x\to x_0^-}f(x)=f(x_0)$，则称函数 $f(x)$ 在点 $x_0$ 处左连续", None),
    ("p", r"若函数 $f(x)$ 在点 $x_0$ 的右侧邻域内有定义，且 $\lim_{x\to x_0^+}f(x)=f(x_0)$，则称函数 $f(x)$ 在点 $x_0$ 处右连续", None),
    ("p", r"定理：函数 $f(x)$ 在点 $x_0$ 处连续的充分必要条件是 $f(x)$ 在 $x_0$ 处左连续且右连续", None),
    ("p", r"$\lim_{x\to x_0}f(x)=f(x_0)\Leftrightarrow\lim_{x\to x_0^-}f(x)=f(x_0)=\lim_{x\to x_0^+}f(x)$", None),
  ]},
 ]},
 10: {"entries": [
  {"id": "gs1-10-1", "title": "间断点的定义", "photos": [6], "rows": [
    ("title", "考点十：函数的间断点及类型的判定", None),
    ("p", r"定义：设函数 $f(x)$ 在点 $x_0$ 的某去心邻域内有定义。在此前提下，如果函数 $f(x)$ 有下列三种情形之一：", None),
    ("p", r"(1) 在点 $x=x_0$ 处没有定义；（即 $x=x_0$ 不在 $f(x)$ 定义域里面）", None),
    ("p", r"(2) 虽在点 $x=x_0$ 处有定义，但 $\lim_{x\to x_0}f(x)$ 不存在；", None),
    ("p", r"(3) 虽在点 $x=x_0$ 处有定义，且 $\lim_{x\to x_0}f(x)$ 存在，但 $\lim_{x\to x_0}f(x)\neq f(x_0)$；", None),
    ("p", r"则函数 $f(x)$ 在点 $x_0$ 处不连续，且点 $x=x_0$ 称为函数 $f(x)$ 的间断点或不连续点。", None),
    ("p", r"注：①间断点的表示形式为 $x=x_0$", None),
    ("p", r"②判断 $x=x_0$ 为间断点时一定要注意前提条件：函数 $f(x)$ 在点 $x_0$ 的某去心邻域内有定义", r"手写：若 $x_0$ 左或右无定义，则 $x=x_0$ 既不是连续点也不是间断点"),
  ]},
  {"id": "gs1-10-2", "title": "总结：间断点的类型", "photos": [6], "rows": [
    ("p", "总结：", None),
    ("tree", "\n".join([
      r"$x=x_0$ 为间断点",
      r"-第一类间断点（$\lim_{x\to x_0^-}f(x)$ 和 $\lim_{x\to x_0^+}f(x)$ 均存在）｜手写：$\lim_{x\to x_0}f(x)$ 存在",
      r"--可去：$\lim_{x\to x_0^-}f(x)=\lim_{x\to x_0^+}f(x)$ ｛$\neq f(x_0)$；在 $x=x_0$ 处没有定义｝｜手写：1　$f(x_0)$ 不存在",
      r"--跳跃：$\lim_{x\to x_0^-}f(x)\neq\lim_{x\to x_0^+}f(x)$｜手写：2",
      r"-第二类间断点（$\lim_{x\to x_0^-}f(x)$ 和 $\lim_{x\to x_0^+}f(x)$ 至少有一个不存在）｜手写：$\lim_{x\to 0^-}f(x)=0$，$\lim_{x\to x_0^+}f(x)=\infty$（下标【看不清】）",
      r"--无穷：$\lim_{x\to x_0^-}f(x)=\infty$ 或 $\lim_{x\to x_0^+}f(x)=\infty$",
      r"--振荡：$\lim_{x\to x_0^-}f(x)\in[a,b]$ 或 $\lim_{x\to x_0^+}f(x)\in[a,b]$｜手写：例：$\sin\infty\in[-1,1]$，$\cos\infty\in[-1,1]$",
    ]), None),
    ("p", r"注：必须通过求极限 $\lim_{x\to x_0}f(x)$ 来确定间断点 $x=x_0$ 的类型", r"手写：找间断点：找无定义点（一般为分母=0的点）或分段点，再去求极限判断类型"),
    ("p", "", r"手写（蓝笔，右端被截断）：若不需要判断类型，只看是不是间断【看不清】　对于无定义点，可直接看定义域，只要【看不清】　左右有定义，则是"),
  ]},
 ]},
 11: {"entries": [
  {"id": "gs1-11-1", "title": "1、最大值和最小值定理　2、有界性定理", "photos": [6], "rows": [
    ("title", "考点十一：闭区间上连续函数的性质", None),
    ("p", r"", r"手写：$[a,b]$"),
    ("p", r"1、最大值和最小值定理：设函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，则函数 $f(x)$ 在闭区间 $[a,b]$ 上必定取得最大值 $M$ 和最小值 $m$", None),
    ("p", r"$m\leq f(x)\leq M$", None),
    ("p", r"2、有界性定理：若函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，则函数 $f(x)$ 在闭区间 $[a,b]$ 上必有界。", None),
  ]},
  {"id": "gs1-11-2", "title": "3、介值定理", "photos": [7], "rows": [
    ("p", r"3、介值定理：若函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，且在这个区间的端点取不同的函数值 $f(a)=A$ 及 $f(b)=B$，则对于 $A$ 和 $B$ 之间的任意一个数 $C$，在开区间 $(a,b)$ 内至少有一点 $\xi$，使得", None),
    ("p", r"$f(\xi)=C\ (a<\xi<b)$", None),
    ("p", r"推论：设函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，$M$ 和 $m$ 分别是 $f(x)$ 在 $[a,b]$ 上的最大值和最小值，则对于满足 $m<\mu<M$ 的任何实数 $\mu$，至少存在一点 $\xi\in(a,b)$，使得 $f(\xi)=\mu$", None),
  ]},
  {"id": "gs1-11-3", "title": "4、零点定理", "photos": [7], "rows": [
    ("p", r"4、零点定理：设函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，且 $f(a)\cdot f(b)<0$，则至少存在一点 $\xi\in(a,b)$，使得 $f(\xi)=0$。", None),
    ("p", r"注：$f(\xi)=0$，则称 $x=\xi$ 为 $f(x)$ 零点，也称 $x=\xi$ 为方程 $f(x)=0$ 的根。", None),
  ]},
 ]},
}
