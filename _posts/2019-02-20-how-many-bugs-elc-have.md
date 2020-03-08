---
layout:     post
title:      "论ELC有多少bug"
subtitle:   "只是吐槽"
date:       2019-02-20 15:40:00
author:     "steve02081504"
tags:
    - ELC
---
#### 怎么可能有标题  
昨天晚上我还和[某hé](https://github.com/xhebox)讨论了下我遇到的编译错误，最后我认为是个visual studio库的bug，然后就提了（[见此](https://developercommunity.visualstudio.com/content/problem/462349/visual-studio20171596the-bug-of-stdis-convertible.html)）  
于是clang暂时爆炸（因为懒得配置clang+mingw  
然后今天改了些代码，于是：  
![全都爆炸](/img/in-post/2019/02-20-15/gcc_boom.jpg)  
gcc也炸了  
（黑人问号脸  
我该说什么呢  
。。。  
【脏话】  
不说了，等晚上回家提bug  
仅此  


______

后记：  
mingw64的bug要在sourceforge.net上提，注册不进去，于是不了了之  
至于clang，vs表示不是自己的锅，怪clang；clang表示怪头文件库提供者  
总之我也懒得管了  
就这样吧  

______

> 生活总是一如既往地烦乱着  
  .....  
  是活着的有效证明,呢.  
