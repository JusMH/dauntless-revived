#include "../HuntIdlePolicy.h"
#include <cassert>
int main() {
    HuntIdlePolicy p;
    assert(!p.Advance(50,false));
    assert(!p.Advance(100,false));
    assert(!p.Advance(1,true));
    assert(!p.Advance(59,false));
    assert(!p.Advance(1,true));
    assert(!p.Advance(179,false));
    assert(p.Advance(1,false));
    HuntIdlePolicy abandoned;
    assert(abandoned.Advance(180,false));
}
