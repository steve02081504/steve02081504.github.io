---
layout:     post
title:      "大整数除法实现：牛顿迭代"
subtitle:   "折腾半天"
date:       2023-03-22 16:59:21
author:     "steve02081504"
tags: 
    - 算法  
    - C++  
    - 大整数  
---

### 起因  

[在此之前elc的大整数除法](https://github.com/ELC-lang/ELC/blob/b11ddd3ed111de3a1e3437d72cd0b515c811c4e4/parts/header_file/files/elc/_files/bignum/bignum/ubigint.hpp#L476L560)实现是用的竖式模拟，单步求商用的是二分查找，效率比较低。  
然后[抱抱熊](https://baobaobear.github.io/)佬说可以摸一摸牛顿迭代，给了一篇全是数学公式的ppt，因为没咋看懂我又找了一堆博客，还顺着博客联系了某个佬（然后被冷处理了，草）  
最后还是用几天摸出来了。  
想着网上博客要么是数学公式，要么是什么离散数学，代码又（对我来说）特别难理解，所以就写了这篇post，希望能帮助到什么有缘人。  
毕竟我粗人一个，看不懂什么公式也不喜欢搞一堆乱七八糟的位操作。  
废话不多说，上代码。  

### 实现  

```cpp
#include <elc/stream>
#include <elc/bignum>

using namespace elc;			 //out ubigint
using namespace elc::defs;		 //pow move

class newton_iteration_num_t{
	mutable ubigint _num;
	mutable size_t	_scale;

	newton_iteration_num_t(ubigint num, size_t scale)noexcept:
		_num(move(num)), _scale(scale) {}
	void add_scale(size_t scale)const noexcept{
		_scale+=scale;
		_num<<=scale;
	}
	void to_same_scale(const newton_iteration_num_t&b)const noexcept{
		if(_scale > b._scale){
			const auto diff = _scale-b._scale;
			b.add_scale(diff);
		}
		else if(_scale < b._scale){
			const auto diff = b._scale-_scale;
			add_scale(diff);
		}
	}
public:
	newton_iteration_num_t(ubigint num)noexcept:
		_num(move(num)), _scale(0) {}
	[[nodiscard]]static newton_iteration_num_t make_begin(const ubigint&num)noexcept{
		return newton_iteration_num_t(1u, get_bitnum(num));
	}
	[[nodiscard]]friend newton_iteration_num_t pow(const newton_iteration_num_t&a, size_t b = 2)noexcept{
		return newton_iteration_num_t(pow(a._num, b), a._scale * b);
	}
	[[nodiscard]]newton_iteration_num_t operator*(const ubigint&a)const&noexcept{
		return newton_iteration_num_t(_num*a, _scale);
	}
	[[nodiscard]]newton_iteration_num_t operator*(const newton_iteration_num_t&a)const&noexcept{
		return newton_iteration_num_t(_num*a._num, _scale+a._scale);
	}
	[[nodiscard]]newton_iteration_num_t operator*(size_t b)const&noexcept{
		return newton_iteration_num_t(_num*b, _scale);
	}
	[[nodiscard]]newton_iteration_num_t operator-(const newton_iteration_num_t&b)const&noexcept{
		to_same_scale(b);
		return newton_iteration_num_t(_num-b._num, _scale);
	}
	[[nodiscard]]explicit operator ubigint()const&noexcept{
		return _num >> _scale;
	}
};
[[nodiscard]]static ubigint newton_iteration_div(ubigint a, ubigint b)noexcept{
	ubigint aret = [&]()noexcept{
		auto	x = newton_iteration_num_t::make_begin(b);
		ubigint aret;
		while(1){
			auto tmp = ubigint(x * a);
			if(tmp == aret)return aret;
			else aret = tmp;
			x = x*2 - pow(x)*b;
		}
	}();
	auto diff = a - aret*b;
	while(diff >= b){//绝大多数情况下这个循环只会走0~1次
		++aret;
		diff-=b;
	}
	//diff是mod，需要的话返回或者用引用传出
	return aret;//aret是quot
}
int main(){
	out << newton_iteration_div(1000000000000000000000000000000000000000000000000000000000000000000000000000000000000_ubigint, 2_ubigint);
}
```

### 代码解释  

[佬](https://baobaobear.github.io/)花了两天一夜和我解释了半天，可能是语言不通罢，最后唯一听明白的是大概要用`x = x*2 - x*x*b`这个公式（后续补充，公式推导可见[这篇](https://blog.csdn.net/DreamBitByBit/article/details/102673035)）。  
没辙，大概摸索一下：  

  1. 先定义`newton_iteration_num_t`表示浮点数（考虑到elc的bigfloat是纯分数实现所以不能用的）  
    - `ubigint _num`表示基数  
    - `size_t _scale`表示指数（负）  
    - 乘法时指数相加，基数相乘  
    - 减法时先把两数的指数调整到一样，再减  
  2. 然后套公式`x = x*2 - x*x*b`迭代，逼近到`x == 1/b`  
  3. 然后乘上`a`就是商了  
    - 运气不好时商可以比实际商大1，用`while`循环减回来（顺便算余数）  
      - 也可以按熊佬的方法，多算一位结果并判断是否该进位，但是实现起来麻烦还无法顺便获得mod的值  
      - 所以我推荐用`while`  
  4. 万一`x`算出来负数，你这`ubigint`怎装得下？  
    - 好问，实际上`x`的起始值比实际值小的话就不会出现负数，`make_begin`就是干这个的  
    - 别问为什，熊佬跟我讲的。  

以上。  

### 优化相关  

一些额外的右值优化代码，影响大意阅读所以放在最后了  

```cpp
newton_iteration_num_t&operator*=(const ubigint&a)&noexcept{
	_num*=a;
	return *this;
}
[[nodiscard]]newton_iteration_num_t&&operator*(const ubigint&a)&&noexcept{
	return move(*this *= a);
}
//...
newton_iteration_num_t&operator*=(const newton_iteration_num_t&a)&noexcept{
	_num*=a._num;
	_scale+=a._scale;
	return *this;
}
[[nodiscard]]newton_iteration_num_t&&operator*(const newton_iteration_num_t&a)&&noexcept{
	return move(*this *= a);
}
//...
newton_iteration_num_t&operator*=(size_t b)&noexcept{
	_num*=b;
	return *this;
}
[[nodiscard]]newton_iteration_num_t&&operator*(size_t b)&&noexcept{
	return move(*this *= b);
}
//...
[[nodiscard]]newton_iteration_num_t&operator-=(const newton_iteration_num_t&b)&noexcept{
	to_same_scale(b);
	_num-=b._num;
	return *this;
}
[[nodiscard]]newton_iteration_num_t&&operator-(const newton_iteration_num_t&b)&&noexcept{
	return move(*this -= b);
}
//...
[[nodiscard]]explicit operator ubigint()&&noexcept{
	return move(move(_num) >> _scale);
}
```
