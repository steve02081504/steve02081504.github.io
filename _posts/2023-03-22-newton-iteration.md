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

在此之前elc的大整数除法实现是用的竖式模拟，单步求商用的是二分查找，效率比较低。  
然后抱抱熊佬说可以摸一摸牛顿迭代，给了我一篇全是数学公式的ppt，我又找了一堆博客，还顺着博客联系了某个佬（然后被冷处理了，草）  
最后我还是用了几天摸出来了。  
想着网上博客要么是数学公式，要么是什么离散数学，代码又（对我来说）特别难理解，所以就写了这篇博客，希望能帮助到什么有缘人。  
毕竟我粗人一个，看不懂公式也不喜欢搞乱七八糟的位操作。  
废话不多说，上代码。  

### 实现  

```cpp
#include <elc/stream>
#include <elc/bignum>

using namespace elc;//out ubigint
using namespace elc::defs;//pow move

class newton_iteration_num_t {
	mutable ubigint _num;
	mutable size_t	_scale;

	newton_iteration_num_t(ubigint num, size_t scale) noexcept:
		_num(move(num)), _scale(scale) {}
	void add_scale(size_t scale) const noexcept {
		_scale += scale;
		_num <<= scale;
	}
	void to_same_scale(const newton_iteration_num_t& b) const noexcept {
		if(_scale > b._scale) {
			const auto diff = _scale - b._scale;
			b.add_scale(diff);
		}
		else if(_scale < b._scale) {
			const auto diff = b._scale - _scale;
			add_scale(diff);
		}
	}
	void rescale() const noexcept {
		const auto rzeros = countr_zero(_num);
		_num >>= rzeros;
		_scale -= rzeros;
	}

public:
	newton_iteration_num_t(ubigint num) noexcept:
		_num(move(num)), _scale(0) {}
	[[nodiscard]] static newton_iteration_num_t make_begin(ubigint num) noexcept {
		return newton_iteration_num_t(1u, get_bitnum(num));
	}
	[[nodiscard]] newton_iteration_num_t operator*(const newton_iteration_num_t& b) const noexcept {
		return newton_iteration_num_t(_num * b._num, _scale + b._scale);
	}
	[[nodiscard]] newton_iteration_num_t operator*(size_t b) const noexcept {
		return newton_iteration_num_t(_num * b, _scale);
	}
	[[nodiscard]] friend newton_iteration_num_t pow(const newton_iteration_num_t& a, size_t b = 2) noexcept {
		return newton_iteration_num_t(pow(a._num, b), a._scale * b);
	}
	[[nodiscard]] newton_iteration_num_t operator-(const newton_iteration_num_t& b) const noexcept {
		to_same_scale(b);
		return newton_iteration_num_t(_num - b._num, _scale);
	}
	[[nodiscard]] explicit operator ubigint() const noexcept {
		return _num >> _scale;
	}
	[[nodiscard]] bool operator==(const newton_iteration_num_t& b) const noexcept {
		to_same_scale(b);
		return _num == b._num;
	}
	newton_iteration_num_t& operator*=(ubigint a) & noexcept {
		_num *= a;
		return *this;
	}
	[[nodiscard]] bool is_safe_to_multiply(ubigint a) const noexcept {
		return get_bitnum(_num) > pow(get_bitnum(a));
	}
	[[nodiscard]] bool is_not_safe_to_multiply(ubigint a) const noexcept {
		return !is_safe_to_multiply(a);
	}
};
[[nodiscard]] static ubigint newton_iteration_div(ubigint a, ubigint b) noexcept {
	ubigint aret = [&]() noexcept {
		auto x = newton_iteration_num_t::make_begin(b);
		do x = x * 2 - pow(x) * b; while(x.is_not_safe_to_multiply(a));
		x *= a;
		return ubigint(x);
	}();
	auto diff = a - aret * b;
	while(diff >= b) { //绝大多数情况下这个循环只会走0~1次
		++aret;
		diff -= b;
	}
	//diff是mod，需要的话返回或者用引用传出
	return aret;//aret是quot
}
int main() {
	out << newton_iteration_div(1000000000000000000000000000000000000000000000000000000000000000000000000000000000000_ubigint, 2_ubigint);
}
```

### 代码解释  

抱抱熊这位佬花了两天一夜给我解释了半天，可能是语言不通罢，最后我唯一听明白的是大概要用`x = x*2 - x*x*b`这个公式。  
没辙，大概摸索一下：  

  1. 先定义`newton_iteration_num_t`表示浮点数（考虑到elc的bigfloat是纯分数实现所以不能用的）  
    - `ubigint _num`表示基数  
    - `size_t _scale`表示指数（负）  
    - 乘法时指数相加，基数相乘  
    - 减法时先把两数的指数调整到一样，再减  
  2. 然后套公式`x = x*2 - x*x*b`迭代，逼近到`1/b`  
    - 怎样算停？`x`的基数的位数大于`a`的位数的二次方时停  
    - 别问我为什，我瞎几把试出来的，这样操作基本上不管`a`和`b`多大都能保证最后修正的次数不会超过`1`。  
  3. 然后乘上`a`就是商了  
    - 运气不好时商可以比实际商大1，用`while`循环减回来（并顺便算余数）  

以上。  

### 实际应用和优化  

实际应用优化时大概注意下右值，可以减少不必要的复制。  
以及可以在循环外把`a`位数的二次方算出来。  
其他的就是一些小优化了，你随意。  
