#pragma once
#include <unordered_map>

// A tick-local index. Read channels through their current array slots so removals,
// reordering and replacement never dereference a cached channel pointer.
template<class Actor, class At, class ActorOf>
auto IndexChannels(int Count, At Get, ActorOf GetActor) {
    std::unordered_map<Actor*, int> Index;
    Index.reserve(Count);
    for (int i = 0; i < Count; ++i)
        if (auto* Value = GetActor(Get(i))) Index.try_emplace(Value, i);
    return Index;
}

template<class Actor, class At, class ActorOf>
auto FindChannel(Actor* ActorToFind, std::unordered_map<Actor*, int>& Index, int Count, At Get, ActorOf GetActor) -> decltype(Get(0)) {
    const auto Found = Index.find(ActorToFind);
    if (Found != Index.end() && Found->second < Count) {
        auto* Channel = Get(Found->second);
        if (GetActor(Channel) == ActorToFind) return Channel;
    }
    if (Found == Index.end()) {
        for (int i = 0; i < Count; ++i) {
            auto* Channel = Get(i);
            if (GetActor(Channel) == ActorToFind) {
                Index.emplace(ActorToFind, i);
                return Channel;
            }
        }
        return nullptr;
    }
    // Replication may reorder/remove channels. Repair the whole tick-local index
    // on a miss so every subsequent actor does not repeat the same linear scan.
    Index = IndexChannels<Actor>(Count, Get, GetActor);
    const auto Current = Index.find(ActorToFind);
    return Current == Index.end() ? nullptr : Get(Current->second);
}
