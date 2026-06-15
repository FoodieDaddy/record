
import os
import subprocess

room_id = "323956355675328512"
nicknames = ["雷霆先锋", "幽灵舰长", "深空探员", "星云猎手", "脉冲守卫", "引力领航", "光速通信", "彗星哨兵", "轨道监控", "黑洞观察", "超新星", "反物质", "夸克机师", "量子技师"]

for i, nick in enumerate(nicknames):
    user_id = 1001 + i
    avatar = f"https://api.dicebear.com/7.x/avataaars/png?seed={i+1}"
    json_val = f'{{"userId":{user_id},"nickname":"{nick}","avatarUrl":"{avatar}","equippedBadge":"","equippedAvatarBorder":"","mbtiTitle":"","mbtiCode":null,"radarStats":{{"socialActivity":50,"riskPreference":50,"resourceControl":50,"allianceTendency":50}}}}'
    
    # Set Data Hash
    cmd_data = f'docker exec sr-redis redis-cli hset "sr:room:{room_id}:data" "user:{user_id}" \'{json_val}\''
    subprocess.run(cmd_data, shell=True)
    
    # Set Score Hash
    cmd_score = f'docker exec sr-redis redis-cli hset "sr:room:{room_id}:scores" "{user_id}" "0"'
    subprocess.run(cmd_score, shell=True)

print("Redis injection complete.")
