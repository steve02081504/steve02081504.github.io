---
layout:     post
title:      "浅谈程序语言设计"
subtitle:   "从本质出发"
date:       2019-01-29 18:00:00
author:     "steve02081504"
tags:
    - 杂谈
---
## 前言  
这是我第一次写blog，想来想去没什么好写的，不如说说程序语言设计吧  
首先，这里说的程序语言只是指可运行语言  
其次，这些大部分是我的主观看法，如果与你的看法不一致，勿喷，请一笑置之  
最后，如果我有什么地方说的不对，请通过[about页面]({{site.url}}/about)内的联系方式告知我，或者在页面最下方评论  

<small style="color:#808080">~~反正我也大概不会改，别把你憋坏了~~</small>  

_____

## 正文  
编程语言的设计是很容易的，定义文法，定义执行方式，完成  
但如何设计出易懂如bf、快速如small talk、简洁如asm、安全如c、自由如java、好看如perl、易学如mma、最好再和scala一样~~引发血案~~造就传奇的语言呢？  
~~[ELC]({{site.url}}/ELC)~~  
首先，我们应当搞清楚为什么会存在编程语言这种东西  
伟大的思想家鲁迅曾经说过：  
> “任何事物都有其存在的原因，~~隔壁翠花也是如此~~”  

为什么现在很少有人用机器语言写程序呢？  
编程语言的意义，或说，其价值，在于以下几点：  
### 细节隐藏  

计算机史上最有历史意义的事情莫过于a=a+1的出现替代了三条asm  
细节隐藏代表着你不用将脑细胞花费在问题的细节上，你大可以关注问题的解决方法，而不是如何分配内存、何时调用fclose：这些计算机早已自动帮我们完成了  
试想一下，如果  
```c++
int a;
{
	//...
	unique_ptr<rand_t> b=new rand_t;
	//...
	b->get_rand(a);
	//...
}
```
需要写成  
```c
int a;
{
	//...
	struct rand_t*b=malloc(sizeof(struct rand_t));
	build_rand_t(b);
	//...
	get_rand_from_rand_t(b,&a);
	//...
	destruct_rand_t(b);
}
```
且不说c版本的代码有忘了free memory之嫌，更不说如果c版本在第二个省略号中直接返回会如何：  
很明显的，在这种情况中，c版本有行数多、要考虑的东西多、出错难找等弊端，而这正是通过细节隐藏能够避免的  
### 抽象  

在我看来，抽象是一种变相的细节隐藏，以至于两者往往难以分清  
从algol68中允许自定义类型，到《[lambda之究极厕所清洁剂](http://lambda-the-ultimate.org/)》提及的scheme中的λ，
实际上，抽象所带来的无非是单个步骤替代多个步骤、考虑范围缩小等，这与细节隐藏是相似的  
### 减少字数  

<small style="color:#808080">实际上抽象也好隐藏细节也罢，都有一个共同点：字数减少了</small>  
cobol的宏绝对是世界上最棒的发明，以至于下到c上到lisp统统效仿，而即便cpp创始人不情不愿，宏功能也仍然在cpp中占有一席之地  
宏给使用者带来了什么？
~~为何众多程序员用宏上瘾？究竟是人性的扭曲还是道德的沦丧？欢迎收看今天的◆◆◆◆，让我们走进项目[steve.h](https://github.com/steve02081504/steve.h)的作者，探究宏的秘~~  
  

宏实际上只是批量的文本修改，但人类
> “真是怠惰啊”
  
_____

在不损伤可读性的情况下，字数这种东西能省就省  
为什么呢？
- 一般来说不损失可读性的代码缩减意味着进一步抽象，而这有利于人的理解  
- 某公司曾做过一个调查，结论是单个程序员单位时间所产出的代码行数固定  
- 此公司还做过一个研究，此研究表明随着代码规模的增长，bug数随之增加  

当然，宏不是唯一节省字数的方法，很多语言有着其他的方法帮助你写出同样效果而字数更少的代码，常见的如`include`或`template`，以及`code generation`  
### ~~给予使用者精神层面的痛苦~~  
这点某知名语言jaba（防律师函，不是拼写错误）的作者做得很棒，本来打算就不班门弄斧了  
但还是觉得要说几句  
你看在这一点上很多语言虽然比不过jiva，但是也做得相当不错  
比如说吧，
- 用户定义的struct使用时必须加上`struct`关键字  
- 死不改写的语法规范  
- 反复修改的语法规范  
- 学语言前先熟悉键盘  
- ”本软件公司长期收购游标卡尺”  
- 听说你们◆◆◆◆◆又双叒叕更新了？ 
- 面向括号编程  
- 你也用◆◆啊，2还是3？  


______

总结一下：
一个好的语言应当具有强大的抽象能力、允许用户隐藏细节、写出来的代码字数少、让使用者放弃希望（？）等特点。  
但这里有一些应当注意的点：  
### 隐藏细节≠放弃细节掌控  
### 抽象≠鬼画符  
### 字数少≠天书  
这些点本来还想细说一下，不过后来想想貌似没有必要  

______

写在最后：
当你确定你的语言大体如何后，你就可以开始实现了  
语法分析方面你可以用的工具有`yacc`、`flex`、`coco`、`javacc`、`grammatica`等一堆子  
如果是编译型语言你还可以依赖于`llvm`等项目  
如果是解释型语言就更为简单了  
不过应当注意的是，尽管使用工具可以让你的语言很快成型，但也会使你错失很多学习的机会  
凡事都有两面性，这是不可避免的  
仅此  

______

日后我大概会写另一篇关于语言实现的博文（咕咕咕）  
仍然是瞎扯，仍然是不知所云  
总之如果愿意关注我的bolg，请于github上watch[此项目](https://github.com/steve02081504/steve02081504.github.io)  
就写到这里好了  

______

> 人类在疯狂探索着这个世界,如同饿狼扑食一般.  
  知道所谓的"求知欲"实际上是什么吗?  
  说得那么好听,也只是在发现探索能够改善生活后,对自己贪得无厌欲望的美称罢了.  
  .....人类,一直如此,着.  
  之前是,现在是,今后,也会是.  
