#!/usr/bin/env python3
"""
Generate test data SQL for Smart Record project.
All tables: user, user_detail, user_identity_level, user_mirror_profile,
mirror_birth_profile, room, room_member, round_record, round_record_detail, fortune_log.
"""
import json
import random
import time

random.seed(42)

# ============================================================
# Helper
# ============================================================
_snowflake_seq = 1000000000000000

def sid():
    global _snowflake_seq
    _snowflake_seq += 1
    return _snowflake_seq

# ============================================================
# Users (25)
# ============================================================
users = [
    # (id, openid, unionid, nickname, avatar_url, status)
    (sid(), 'wx_openid_001', 'wx_union_001', '大聪明', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/001.png', 0),
    (sid(), 'wx_openid_002', 'wx_union_002', '小幸运', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/002.png', 0),
    (sid(), 'wx_openid_003', 'wx_union_003', '麻将王', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/003.png', 0),
    (sid(), 'wx_openid_004', 'wx_union_004', '扑克脸', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/004.png', 0),
    (sid(), 'wx_openid_005', 'wx_union_005', '记分员', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/005.png', 0),
    (sid(), 'wx_openid_006', 'wx_union_006', '桌游达人', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/006.png', 0),
    (sid(), 'wx_openid_007', 'wx_union_007', '策略家', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/007.png', 0),
    (sid(), 'wx_openid_008', 'wx_union_008', '观战者', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/008.png', 0),
    (sid(), 'wx_openid_009', 'wx_union_009', '新来的', '', 0),
    (sid(), 'wx_openid_010', 'wx_union_010', '老玩家', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/010.png', 0),
    (sid(), 'wx_openid_011', 'wx_union_011', '淡定哥', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/011.png', 0),
    (sid(), 'wx_openid_012', 'wx_union_012', '暴躁姐', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/012.png', 0),
    (sid(), 'wx_openid_013', 'wx_union_013', '佛系玩家', '', 0),
    (sid(), 'wx_openid_014', 'wx_union_014', '数据控', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/014.png', 0),
    (sid(), 'wx_openid_015', 'wx_union_015', '随机手', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/015.png', 0),
    (sid(), 'wx_openid_016', 'wx_union_016', '速算王', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/016.png', 0),
    (sid(), 'wx_openid_017', 'wx_union_017', '夜猫子', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/017.png', 0),
    (sid(), 'wx_openid_018', 'wx_union_018', '早起鸟', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/018.png', 0),
    (sid(), 'wx_openid_019', 'wx_union_019', '沙发客', '', 0),
    (sid(), 'wx_openid_020', 'wx_union_020', '排行榜', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/020.png', 0),
    (sid(), 'wx_openid_021', 'wx_union_021', '小透明', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/021.png', 0),
    (sid(), 'wx_openid_022', 'wx_union_022', '隐藏大佬', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/022.png', 0),
    (sid(), 'wx_openid_023', 'wx_union_023', '咸鱼王', 'https://smartrecord.oss-cn-hangzhou.aliyuncs.com/avatar/023.png', 0),
    (sid(), 'wx_openid_024', 'wx_union_024', '新人甲', '', 0),
    (sid(), 'wx_openid_025', 'wx_union_025', '新人乙', '', 0),
]
uid = [u[0] for u in users]  # index 0-24

# ============================================================
# Time helpers
# ============================================================
def dt(y, m, d, h=0, mi=0, s=0):
    return f'{y:04d}-{m:02d}-{d:02d} {h:02d}:{mi:02d}:{s:02d}'

def ms(y, m, d, h=0, mi=0, s=0):
    """Return epoch millis for building all_record JSON."""
    import datetime
    t = datetime.datetime(y, m, d, h, mi, s)
    return int(t.timestamp() * 1000)

# ============================================================
# Room definitions
# ============================================================
# Each room: (room_no, owner_idx, member_indices, score_mode, round_input_method, trust_mode, zero_sum, created_at, updated_at, batches)
# batch: list of (delta_per_member) where delta_per_member is dict {member_idx: score_delta}
# For zero_sum rooms, each batch must sum to 0.

rooms = []

# --- FREE FLOW rooms (score_mode=1) ---

# Room 1: 4 players, zero_sum, created 2026-06-06
room_no_seq = 0
def next_room_no():
    global room_no_seq
    chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    room_no_seq += 1
    return ''.join(random.choice(chars) for _ in range(6))

r = {
    'no': 'A3K7NP', 'owner': 0, 'members': [0, 1, 2, 3],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 1,
    'created': dt(2026,6,6,10,0,0), 'updated': dt(2026,6,6,12,30,0),
    'batches': [
        (ms(2026,6,6,10,5,0), 0, {0: 50, 1: -20, 2: -10, 3: -20}),
        (ms(2026,6,6,10,15,0), 0, {0: 10, 1: 30, 2: -30, 3: -10}),
        (ms(2026,6,6,10,30,0), 0, {0: -40, 1: 20, 2: 30, 3: -10}),
        (ms(2026,6,6,11,0,0), 0, {0: -20, 1: -30, 2: 10, 3: 40}),
    ],
    'transfer_events': [
        {'from': uid[0], 'to': uid[1], 'amount': 20, 'time': ms(2026,6,6,10,6,0), 'remark': ''},
        {'from': uid[2], 'to': uid[3], 'amount': 10, 'time': ms(2026,6,6,10,16,0), 'remark': ''},
        {'from': uid[1], 'to': uid[0], 'amount': 30, 'time': ms(2026,6,6,10,31,0), 'remark': ''},
        {'from': uid[3], 'to': uid[2], 'amount': 40, 'time': ms(2026,6,6,11,1,0), 'remark': '翻盘'},
    ],
}
rooms.append(r)

# Room 2: 3 players, non-zero_sum, created 2026-06-05
r = {
    'no': 'B5M2QR', 'owner': 1, 'members': [1, 4, 5],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 0,
    'created': dt(2026,6,5,14,0,0), 'updated': dt(2026,6,5,16,0,0),
    'batches': [
        (ms(2026,6,5,14,10,0), 1, {1: 100, 4: -50, 5: -30}),
        (ms(2026,6,5,14,30,0), 4, {1: -80, 4: 60, 5: 10}),
        (ms(2026,6,5,15,0,0), 1, {1: 30, 4: -20, 5: -40}),
    ],
    'transfer_events': [
        {'from': uid[4], 'to': uid[1], 'amount': 50, 'time': ms(2026,6,5,14,11,0), 'remark': ''},
        {'from': uid[1], 'to': uid[4], 'amount': 60, 'time': ms(2026,6,5,14,31,0), 'remark': ''},
    ],
}
rooms.append(r)

# Room 3: 2 players, zero_sum, 2026-06-04
r = {
    'no': 'C8N4ST', 'owner': 2, 'members': [2, 6],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 1,
    'created': dt(2026,6,4,20,0,0), 'updated': dt(2026,6,4,21,30,0),
    'batches': [
        (ms(2026,6,4,20,5,0), 2, {2: 100, 6: -100}),
        (ms(2026,6,4,20,20,0), 6, {2: -200, 6: 200}),
        (ms(2026,6,4,20,45,0), 2, {2: 150, 6: -150}),
        (ms(2026,6,4,21,0,0), 6, {2: -50, 6: 50}),
    ],
    'transfer_events': [],
}
rooms.append(r)

# Room 4: 5 players, zero_sum, 2026-06-03
r = {
    'no': 'D2P6UV', 'owner': 3, 'members': [3, 7, 8, 9, 10],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 1,
    'created': dt(2026,6,3,18,0,0), 'updated': dt(2026,6,3,20,0,0),
    'batches': [
        (ms(2026,6,3,18,10,0), 3, {3: 80, 7: -30, 8: -20, 9: -10, 10: -20}),
        (ms(2026,6,3,18,30,0), 7, {3: -50, 7: 60, 8: -30, 9: 10, 10: 10}),
        (ms(2026,6,3,19,0,0), 9, {3: -30, 7: -20, 8: 50, 9: 20, 10: -20}),
        (ms(2026,6,3,19,30,0), 3, {3: 0, 7: -10, 8: 0, 9: -20, 10: 30}),
    ],
    'transfer_events': [
        {'from': uid[7], 'to': uid[3], 'amount': 30, 'time': ms(2026,6,3,18,11,0), 'remark': ''},
    ],
}
rooms.append(r)

# Room 5: 6 players, non-zero_sum, 2026-06-02
r = {
    'no': 'E9R1WX', 'owner': 4, 'members': [4, 11, 12, 13, 14, 15],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 0,
    'created': dt(2026,6,2,15,0,0), 'updated': dt(2026,6,2,17,30,0),
    'batches': [
        (ms(2026,6,2,15,10,0), 4, {4: 50, 11: -30, 12: 20, 13: -10, 14: 30, 15: -20}),
        (ms(2026,6,2,15,40,0), 11, {4: -20, 11: 40, 12: -30, 13: 20, 14: -10, 15: 10}),
        (ms(2026,6,2,16,10,0), 12, {4: 30, 11: -10, 12: 50, 13: -40, 14: 20, 15: -30}),
    ],
    'transfer_events': [
        {'from': uid[11], 'to': uid[4], 'amount': 30, 'time': ms(2026,6,2,15,11,0), 'remark': ''},
        {'from': uid[13], 'to': uid[12], 'amount': 40, 'time': ms(2026,6,2,16,11,0), 'remark': ''},
    ],
}
rooms.append(r)

# Room 6: 3 players, zero_sum, 2026-05-30
r = {
    'no': 'F4T8YZ', 'owner': 5, 'members': [5, 10, 16],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 1,
    'created': dt(2026,5,30,19,0,0), 'updated': dt(2026,5,30,21,0,0),
    'batches': [
        (ms(2026,5,30,19,10,0), 5, {5: 200, 10: -100, 16: -100}),
        (ms(2026,5,30,19,40,0), 10, {5: -150, 10: 200, 16: -50}),
        (ms(2026,5,30,20,10,0), 16, {5: -50, 10: -100, 16: 150}),
    ],
    'transfer_events': [],
}
rooms.append(r)

# Room 7: 4 players, non-zero_sum, 2026-05-25
r = {
    'no': 'G7V3AB', 'owner': 6, 'members': [6, 7, 17, 18],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 0,
    'created': dt(2026,5,25,20,0,0), 'updated': dt(2026,5,25,22,0,0),
    'batches': [
        (ms(2026,5,25,20,10,0), 6, {6: 100, 7: -50, 17: -30, 18: -10}),
        (ms(2026,5,25,20,40,0), 7, {6: -80, 7: 120, 17: -20, 18: -10}),
        (ms(2026,5,25,21,10,0), 17, {6: -20, 7: -70, 17: 80, 18: 30}),
        (ms(2026,5,25,21,40,0), 6, {6: 50, 7: -30, 17: -10, 18: -20}),
    ],
    'transfer_events': [
        {'from': uid[7], 'to': uid[6], 'amount': 50, 'time': ms(2026,5,25,20,11,0), 'remark': ''},
        {'from': uid[6], 'to': uid[7], 'amount': 80, 'time': ms(2026,5,25,20,41,0), 'remark': ''},
    ],
}
rooms.append(r)

# Room 8: 2 players, zero_sum, 2026-05-20
r = {
    'no': 'H1W5CD', 'owner': 10, 'members': [10, 19],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 1,
    'created': dt(2026,5,20,10,0,0), 'updated': dt(2026,5,20,11,0,0),
    'batches': [
        (ms(2026,5,20,10,5,0), 10, {10: 500, 19: -500}),
        (ms(2026,5,20,10,30,0), 19, {10: -800, 19: 800}),
        (ms(2026,5,20,10,50,0), 10, {10: 300, 19: -300}),
    ],
    'transfer_events': [],
}
rooms.append(r)

# Room 9: 4 players, non-zero_sum, 2026-04-15
r = {
    'no': 'J6X9EF', 'owner': 11, 'members': [11, 14, 20, 21],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 0,
    'created': dt(2026,4,15,14,0,0), 'updated': dt(2026,4,15,16,30,0),
    'batches': [
        (ms(2026,4,15,14,10,0), 11, {11: 80, 14: -40, 20: -20, 21: -10}),
        (ms(2026,4,15,14,50,0), 14, {11: -60, 14: 100, 20: -30, 21: -10}),
        (ms(2026,4,15,15,30,0), 20, {11: -20, 14: -60, 20: 90, 21: -10}),
    ],
    'transfer_events': [
        {'from': uid[14], 'to': uid[11], 'amount': 40, 'time': ms(2026,4,15,14,11,0), 'remark': ''},
    ],
}
rooms.append(r)

# Room 10: 3 players, zero_sum, 2026-03-10
r = {
    'no': 'K2Y7GH', 'owner': 22, 'members': [22, 23, 24],
    'sm': 1, 'rim': None, 'tm': None, 'zs': 1,
    'created': dt(2026,3,10,16,0,0), 'updated': dt(2026,3,10,18,0,0),
    'batches': [
        (ms(2026,3,10,16,10,0), 22, {22: 100, 23: -50, 24: -50}),
        (ms(2026,3,10,16,40,0), 23, {22: -200, 23: 150, 24: 50}),
        (ms(2026,3,10,17,10,0), 24, {22: 100, 23: -100, 24: 0}),
    ],
    'transfer_events': [],
}
rooms.append(r)

# --- ROUND RECORD rooms (score_mode=2) ---

# Room 11: 4 players, host_fill, trust=1, zero_sum=1, 2026-06-06
r = {
    'no': 'L8Z4IJ', 'owner': 0, 'members': [0, 4, 9, 15],
    'sm': 2, 'rim': 1, 'tm': 1, 'zs': 1,
    'created': dt(2026,6,6,13,0,0), 'updated': dt(2026,6,6,14,0,0),
    'rounds': [
        {'created_at': dt(2026,6,6,13,5,0), 'applied_at': dt(2026,6,6,13,5,30), 'created_by': 0,
         'scores': {0: 100, 4: -50, 9: -30, 15: -20}},
        {'created_at': dt(2026,6,6,13,20,0), 'applied_at': dt(2026,6,6,13,20,30), 'created_by': 0,
         'scores': {0: -80, 4: 60, 9: 10, 15: 10}},
        {'created_at': dt(2026,6,6,13,40,0), 'applied_at': dt(2026,6,6,13,40,30), 'created_by': 0,
         'scores': {0: -20, 4: -10, 9: 20, 15: 10}},
    ],
}
rooms.append(r)

# Room 12: 3 players, host_fill, trust=0, zero_sum=1, 2026-06-05
r = {
    'no': 'M5A6KL', 'owner': 1, 'members': [1, 5, 10],
    'sm': 2, 'rim': 1, 'tm': 0, 'zs': 1,
    'created': dt(2026,6,5,10,0,0), 'updated': dt(2026,6,5,12,0,0),
    'rounds': [
        {'created_at': dt(2026,6,5,10,5,0), 'applied_at': dt(2026,6,5,10,10,0), 'created_by': 1,
         'scores': {1: 150, 5: -80, 10: -70}},
        {'created_at': dt(2026,6,5,10,40,0), 'applied_at': dt(2026,6,5,10,50,0), 'created_by': 1,
         'scores': {1: -100, 5: 120, 10: -20}},
        {'created_at': dt(2026,6,5,11,20,0), 'applied_at': dt(2026,6,5,11,30,0), 'created_by': 1,
         'scores': {1: -50, 5: -40, 10: 90}},
    ],
}
rooms.append(r)

# Room 13: 5 players, member_fill, trust=1, zero_sum=1, 2026-06-04
r = {
    'no': 'N3B8MN', 'owner': 2, 'members': [2, 6, 11, 16, 20],
    'sm': 2, 'rim': 2, 'tm': 1, 'zs': 1,
    'created': dt(2026,6,4,15,0,0), 'updated': dt(2026,6,4,17,0,0),
    'rounds': [
        {'created_at': dt(2026,6,4,15,5,0), 'applied_at': dt(2026,6,4,15,5,30), 'created_by': 2,
         'scores': {2: 80, 6: -30, 11: -20, 16: -10, 20: -20}},
        {'created_at': dt(2026,6,4,15,40,0), 'applied_at': dt(2026,6,4,15,40,30), 'created_by': 2,
         'scores': {2: -60, 6: 50, 11: -30, 16: 20, 20: 20}},
        {'created_at': dt(2026,6,4,16,20,0), 'applied_at': dt(2026,6,4,16,20,30), 'created_by': 2,
         'scores': {2: -20, 6: -20, 11: 50, 16: -10, 20: 0}},
    ],
}
rooms.append(r)

# Room 14: 4 players, host_fill, trust=1, zero_sum=0, 2026-06-03
r = {
    'no': 'P7C2OP', 'owner': 3, 'members': [3, 8, 12, 17],
    'sm': 2, 'rim': 1, 'tm': 1, 'zs': 0,
    'created': dt(2026,6,3,10,0,0), 'updated': dt(2026,6,3,12,0,0),
    'rounds': [
        {'created_at': dt(2026,6,3,10,5,0), 'applied_at': dt(2026,6,3,10,5,30), 'created_by': 3,
         'scores': {3: 100, 8: -50, 12: -30, 17: -10}},
        {'created_at': dt(2026,6,3,10,40,0), 'applied_at': dt(2026,6,3,10,40,30), 'created_by': 3,
         'scores': {3: -70, 8: 80, 12: -20, 17: 10}},
    ],
}
rooms.append(r)

# Room 15: 3 players, member_fill, trust=0, zero_sum=1, 2026-05-28
r = {
    'no': 'Q9D5QR', 'owner': 7, 'members': [7, 13, 18],
    'sm': 2, 'rim': 2, 'tm': 0, 'zs': 1,
    'created': dt(2026,5,28,19,0,0), 'updated': dt(2026,5,28,21,0,0),
    'rounds': [
        {'created_at': dt(2026,5,28,19,5,0), 'applied_at': dt(2026,5,28,19,15,0), 'created_by': 7,
         'scores': {7: 200, 13: -100, 18: -100}},
        {'created_at': dt(2026,5,28,20,0,0), 'applied_at': dt(2026,5,28,20,10,0), 'created_by': 7,
         'scores': {7: -300, 13: 200, 18: 100}},
        {'created_at': dt(2026,5,28,20,30,0), 'applied_at': dt(2026,5,28,20,40,0), 'created_by': 7,
         'scores': {7: 100, 13: -100, 18: 0}},
    ],
}
rooms.append(r)

# Room 16: 6 players, host_fill, trust=1, zero_sum=1, 2026-05-15
r = {
    'no': 'R1E7ST', 'owner': 9, 'members': [9, 10, 11, 12, 13, 14],
    'sm': 2, 'rim': 1, 'tm': 1, 'zs': 1,
    'created': dt(2026,5,15,14,0,0), 'updated': dt(2026,5,15,16,0,0),
    'rounds': [
        {'created_at': dt(2026,5,15,14,10,0), 'applied_at': dt(2026,5,15,14,10,30), 'created_by': 9,
         'scores': {9: 100, 10: -30, 11: -20, 12: -20, 13: -10, 14: -20}},
        {'created_at': dt(2026,5,15,15,0,0), 'applied_at': dt(2026,5,15,15,0,30), 'created_by': 9,
         'scores': {9: -80, 10: 60, 11: -30, 12: 20, 13: 10, 14: 20}},
        {'created_at': dt(2026,5,15,15,30,0), 'applied_at': dt(2026,5,15,15,30,30), 'created_by': 9,
         'scores': {9: -20, 10: -30, 11: 50, 12: 0, 13: -10, 14: 10}},
    ],
}
rooms.append(r)

# Room 17: 4 players, host_fill, trust=1, zero_sum=0, 2026-04-20
r = {
    'no': 'S4F9UV', 'owner': 15, 'members': [15, 16, 19, 21],
    'sm': 2, 'rim': 1, 'tm': 1, 'zs': 0,
    'created': dt(2026,4,20,18,0,0), 'updated': dt(2026,4,20,20,0,0),
    'rounds': [
        {'created_at': dt(2026,4,20,18,10,0), 'applied_at': dt(2026,4,20,18,10,30), 'created_by': 15,
         'scores': {15: 120, 16: -60, 19: -40, 21: -10}},
        {'created_at': dt(2026,4,20,19,0,0), 'applied_at': dt(2026,4,20,19,0,30), 'created_by': 15,
         'scores': {15: -80, 16: 100, 19: -20, 21: 10}},
    ],
}
rooms.append(r)

# Room 18: 2 players, host_fill, trust=1, zero_sum=1, 2026-03-25
r = {
    'no': 'T8G3WX', 'owner': 20, 'members': [20, 22],
    'sm': 2, 'rim': 1, 'tm': 1, 'zs': 1,
    'created': dt(2026,3,25,20,0,0), 'updated': dt(2026,3,25,21,30,0),
    'rounds': [
        {'created_at': dt(2026,3,25,20,5,0), 'applied_at': dt(2026,3,25,20,5,30), 'created_by': 20,
         'scores': {20: 300, 22: -300}},
        {'created_at': dt(2026,3,25,20,40,0), 'applied_at': dt(2026,3,25,20,40,30), 'created_by': 20,
         'scores': {20: -500, 22: 500}},
        {'created_at': dt(2026,3,25,21,10,0), 'applied_at': dt(2026,3,25,21,10,30), 'created_by': 20,
         'scores': {20: 200, 22: -200}},
    ],
}
rooms.append(r)

# Room 19: 3 players, member_fill, trust=1, zero_sum=0, 2026-04-10
r = {
    'no': 'U6H8YZ', 'owner': 23, 'members': [23, 24, 0],
    'sm': 2, 'rim': 2, 'tm': 1, 'zs': 0,
    'created': dt(2026,4,10,15,0,0), 'updated': dt(2026,4,10,17,0,0),
    'rounds': [
        {'created_at': dt(2026,4,10,15,10,0), 'applied_at': dt(2026,4,10,15,10,30), 'created_by': 23,
         'scores': {23: 80, 24: -50, 0: -20}},
        {'created_at': dt(2026,4,10,16,0,0), 'applied_at': dt(2026,4,10,16,0,30), 'created_by': 23,
         'scores': {23: -60, 24: 100, 0: -30}},
    ],
}
rooms.append(r)

# Room 20: 4 players, host_fill, trust=0, zero_sum=1, 2026-06-01
r = {
    'no': 'V2J1AB', 'owner': 1, 'members': [1, 3, 6, 8],
    'sm': 2, 'rim': 1, 'tm': 0, 'zs': 1,
    'created': dt(2026,6,1,10,0,0), 'updated': dt(2026,6,1,12,0,0),
    'rounds': [
        {'created_at': dt(2026,6,1,10,5,0), 'applied_at': dt(2026,6,1,10,15,0), 'created_by': 1,
         'scores': {1: 60, 3: -20, 6: -30, 8: -10}},
        {'created_at': dt(2026,6,1,10,40,0), 'applied_at': dt(2026,6,1,10,50,0), 'created_by': 1,
         'scores': {1: -40, 3: 50, 6: -10, 8: 0}},
        {'created_at': dt(2026,6,1,11,20,0), 'applied_at': dt(2026,6,1,11,30,0), 'created_by': 1,
         'scores': {1: -20, 3: -30, 6: 40, 8: 10}},
    ],
}
rooms.append(r)

# ============================================================
# Compute final scores and build all_record JSON
# ============================================================
for r in rooms:
    final = {}
    all_record = []

    if r['sm'] == 1:
        # Free flow mode
        for batch_ts, created_by, deltas in r['batches']:
            rec = {'batchTime': batch_ts, 'createdBy': uid[created_by], 'scores': []}
            for midx, delta in deltas.items():
                final.setdefault(midx, 0)
                final[midx] += delta
                u = users[midx]
                rec['scores'].append({
                    'userId': u[0], 'score': delta,
                    'name': u[3], 'avatar': u[4]
                })
            all_record.append(rec)

        # Add transferEvents as last element
        if r.get('transfer_events'):
            all_record.append({'transferEvents': r['transfer_events']})

        # Verify zero_sum
        if r['zs']:
            for batch_ts, created_by, deltas in r['batches']:
                assert sum(deltas.values()) == 0, f"Batch in room {r['no']} doesn't sum to 0: {sum(deltas.values())}"
            assert sum(final.values()) == 0, f"Room {r['no']} final doesn't sum to 0: {sum(final.values())}"

    else:
        # Round record mode
        for rd in r['rounds']:
            scores = rd['scores']
            total = sum(scores.values())
            if r['zs']:
                assert total == 0, f"Round in room {r['no']} doesn't sum to 0: {total}"

            rec = {
                'type': 'ROUND_RECORD',
                'batchTime': ms(*[int(x) for x in rd['applied_at'].replace('-', ' ').replace(':', ' ').split()]),
                'roundId': sid(),
                'inputMethod': r['rim'],
                'trustMode': r['tm'],
                'zeroSumRequired': r['zs'],
                'scores': [],
                'totalScore': total
            }
            for midx, delta in scores.items():
                final.setdefault(midx, 0)
                final[midx] += delta
                u = users[midx]
                rec['scores'].append({
                    'userId': u[0], 'score': delta
                })
            all_record.append(rec)

    r['final'] = final
    r['all_record'] = all_record

# ============================================================
# Generate SQL
# ============================================================
lines = []

def sql(s):
    lines.append(s)

# --- user ---
for u in users:
    sql(f"INSERT INTO `user` (`id`,`openid`,`unionid`,`nickname`,`avatar_url`,`status`,`created_at`,`updated_at`) VALUES ({u[0]},'{u[1]}','{u[2]}','{u[3]}','{u[4]}',{u[5]},'2026-01-15 10:00:00','2026-01-15 10:00:00');")

# --- user_detail ---
voice_ids = ['std_01','std_02','std_03','std_04','std_05']
for i, u in enumerate(users):
    vid = voice_ids[i % len(voice_ids)]
    ve = random.choice([0, 1])
    ae = random.choice([0, 1])
    vibe = random.choice([0, 1])
    sql(f"INSERT INTO `user_detail` (`id`,`voice_enabled`,`voice_id`,`anim_enabled`,`vibrate_enabled`,`created_at`,`updated_at`) VALUES ({u[0]},{ve},'{vid}',{ae},{vibe},'2026-01-15 10:00:00','2026-01-15 10:00:00');")

# --- user_identity_level ---
# Rich users (frequent players)
rich_users = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 14, 15, 20, 22]
for idx in rich_users:
    u = users[idx]
    level = random.choice([2, 3, 4])
    exp = level * 300 + random.randint(0, 500)
    stability = random.randint(40, 90)
    sql(f"INSERT INTO `user_identity_level` (`user_id`,`level`,`exp`,`stability`,`updated_at`) VALUES ({u[0]},{level},{exp},{stability},'2026-06-06 10:00:00');")

# New users (level 1)
for idx in [8, 9, 13, 16, 17, 18, 19, 21, 23, 24]:
    u = users[idx]
    sql(f"INSERT INTO `user_identity_level` (`user_id`,`level`,`exp`,`stability`,`updated_at`) VALUES ({u[0]},1,{random.randint(0,50)},NULL,'2026-06-06 10:00:00');")

# --- user_mirror_profile ---
mbti_map = {
    0: (1, 'test', 85.5),    # INTJ
    1: (8, 'direct', 100),   # ENFP
    2: (15, 'test', 72.3),   # ESTP
    3: (9, 'test', 91.0),    # ISTJ
    4: (4, 'direct', 100),   # ENTP
    5: (6, 'test', 68.7),    # INFP
    6: (3, 'direct', 100),   # ENTJ
    7: (11, 'test', 78.2),   # ESTJ
    10: (5, 'test', 82.4),   # INFJ
    11: (13, 'direct', 100), # ISTP
    14: (2, 'test', 75.0),   # INTP
    15: (16, 'test', 65.3),  # ESFP
    20: (7, 'direct', 100),  # ENFJ
    22: (10, 'test', 88.1),  # ISFJ
}

persona_tags = {
    0: ('压制者', 'THE DOMINATOR', '强势控场型选手，善于利用节奏压制对手', 8),
    1: ('机会游走者', 'THE DRIFTER', '善于捕捉转瞬即逝的机会', 12),
    2: ('高压突击手', 'THE BLITZ', '高压环境下爆发力极强', 6),
    3: ('纪律执行者', 'THE EXECUTOR', '严格遵循计划，低失误率', 10),
    4: ('扰动型试探者', 'THE PROBER', '善于用非常规手段打乱对手节奏', 9),
    5: ('蛰伏者', 'THE WATCHER', '善于等待时机，一击致命', 7),
    6: ('压迫型指挥者', 'THE COMMANDER', '高压决策能力出色', 11),
    7: ('规则型压制者', 'THE ENFORCER', '善于利用规则建立优势', 5),
    10: ('远读型观察者', 'THE READER', '善于从细节中读取对手意图', 14),
    11: ('冷启动猎手', 'THE COLD START', '即使不熟悉环境也能快速适应', 4),
    14: ('模型型分析者', 'THE ANALYST', '善于建立模型分析对手行为', 13),
    15: ('现场型爆发者', 'THE BURSTER', '现场气氛越热烈表现越好', 3),
    20: ('节奏型组织者', 'THE ORGANIZER', '善于组织团队节奏', 15),
    22: ('防守型稳定者', 'THE ANCHOR', '团队中最稳定的防守核心', 9),
}

for idx, (code, source, conf) in mbti_map.items():
    u = users[idx]
    tag, title, summary, sample = persona_tags[idx]
    calibrated_at = '2026-05-01 10:00:00' if source == 'test' else '2026-04-15 14:00:00'
    persona_calc = '2026-06-05 22:00:00'
    answers_json = 'null'
    if source == 'test':
        answers = [random.choice([0,1]) for _ in range(20)]
        answers_json = json.dumps(answers)

    sql(f"INSERT INTO `user_mirror_profile` (`user_id`,`mbti_code`,`mbti_source`,`mbti_confidence`,`mbti_test_version`,`mbti_answers_json`,`calibrated_at`,`battle_persona_tag`,`battle_persona_title`,`battle_persona_summary`,`battle_persona_json`,`sample_size`,`persona_calculated_at`,`created_at`,`updated_at`) VALUES ({u[0]},{code},'{source}',{conf},'v1',{answers_json},'{calibrated_at}','{tag}','{title}','{summary}',NULL,{sample},'{persona_calc}','2026-04-01 10:00:00','2026-06-05 22:00:00');")

# --- mirror_birth_profile ---
birth_profiles = [
    (0, 'solar', '1995-03-15', '14:30', '上海', 'Asia/Shanghai', 'male'),
    (1, 'solar', '1998-07-22', '09:00', '北京', 'Asia/Shanghai', 'female'),
    (2, 'solar', '1992-11-08', '22:15', '广州', 'Asia/Shanghai', 'male'),
    (3, 'lunar', '1990-01-28', '06:45', '成都', 'Asia/Shanghai', 'male'),
    (6, 'solar', '1996-05-10', '18:30', '杭州', 'Asia/Shanghai', 'female'),
    (10, 'solar', '1993-09-14', '11:00', '深圳', 'Asia/Shanghai', 'male'),
    (20, 'lunar', '1997-12-03', '08:15', '武汉', 'Asia/Shanghai', 'female'),
]
for bp in birth_profiles:
    sql(f"INSERT INTO `mirror_birth_profile` (`user_id`,`calendar_type`,`birth_date`,`birth_time`,`birth_place`,`timezone`,`gender`,`extra_json`,`created_at`,`updated_at`) VALUES ({users[bp[0]][0]},'{bp[1]}','{bp[2]}','{bp[3]}','{bp[4]}','{bp[5]}','{bp[6]}',NULL,'2026-03-01 10:00:00','2026-03-01 10:00:00');")

# --- fortune_log ---
fortune_entries = [
    (0, 'WINNING_STREAK', 'llm', 'mimo-v2.5', 1),
    (0, 'STABLE', 'fallback', '', 1),
    (1, 'LOSING_STREAK', 'llm', 'mimo-v2.5', 1),
    (2, 'HIGH_RISK', 'llm', 'mimo-v2.5', 1),
    (3, 'STABLE', 'fallback', '', 1),
    (4, 'WINNING_STREAK', 'llm', 'mimo-v2.5', 1),
    (5, 'STABLE', 'llm', 'mimo-v2.5', 1),
    (6, 'LOSING_STREAK', 'fallback', '', 0),
    (10, 'STABLE', 'llm', 'mimo-v2.5', 1),
    (11, 'HIGH_RISK', 'llm', 'mimo-v2.5', 1),
    (14, 'WINNING_STREAK', 'fallback', '', 1),
    (20, 'STABLE', 'llm', 'mimo-v2.5', 1),
    (22, 'LOSING_STREAK', 'llm', 'mimo-v2.5', 1),
]

fortune_verdicts = {
    'WINNING_STREAK': ('气场如虹，连胜势能持续扩散', '["连胜势能加持","心态稳定输出","决策果断精准"]', '["注意骄傲轻敌","避免贪心冒进"]', '#32D74B', '理智'),
    'LOSING_STREAK': ('低谷是蓄力的过程，静待反弹', '["触底反弹势能","心态沉淀内敛","经验持续积累"]', '["避免情绪化决策","注意休息调整"]', '#FF9F0A', '蓄力'),
    'HIGH_RISK': ('波动即机遇，关键在于时机把控', '["高波动校准力","爆发力惊人强劲","时机嗅觉敏锐"]', '["风险敞口较大","情绪波动影响判断"]', '#FF2D55', '狂野'),
    'STABLE': ('平稳是最好的基底，细水长流', '["心态平稳如水","节奏稳定输出","持续高效作战"]', '["缺乏爆发力","注意抓住转瞬机会"]', '#0A84FF', '稳健'),
}

fortune_dates = ['2026-06-06','2026-06-05','2026-06-04','2026-06-03','2026-06-02','2026-06-01','2026-05-30','2026-05-28','2026-05-25','2026-05-20','2026-04-15','2026-04-10','2026-03-25']

for i, (user_idx, tag, source, model, success) in enumerate(fortune_entries):
    u = users[user_idx]
    v, buffs, debuffs, color, ttag = fortune_verdicts[tag]
    result_json = json.dumps({
        'verdict': v, 'buffs': json.loads(buffs), 'debuffs': json.loads(debuffs),
        'glowColor': color, 'tag': ttag, 'userTag': tag, 'source': source,
        'lunarDate': fortune_dates[i % len(fortune_dates)],
        'solarTerm': 'CRUISE', 'title': '压制者', 'subtitle': 'THE DOMINATOR',
        'tags': ['强势','连续','压制']
    }, ensure_ascii=False)
    prompt = f'玩家画像：{tag}，累计净积分：100分'
    system_prompt = '你是策略解释引擎...' if source == 'llm' else ''
    raw_resp = result_json if source == 'llm' else 'LLM 未配置，使用本地兜底'
    dur = random.randint(200, 3000) if source == 'llm' else 0
    error_msg = '' if success else 'LLM API 超时'
    fd = fortune_dates[i % len(fortune_dates)]

    sql(f"INSERT INTO `fortune_log` (`id`,`user_id`,`user_tag`,`source`,`model`,`prompt`,`system_prompt`,`raw_response`,`result_json`,`duration_ms`,`success`,`error_msg`,`created_at`) VALUES ({sid()},{u[0]},'{tag}','{source}','{model}','{prompt}','{system_prompt}','{raw_resp}','{result_json.replace(chr(39), chr(39)+chr(39))}',{dur},{success},'{error_msg}','{fd} 12:00:00');")

# --- room + room_member ---
room_ids = []
for ri, r in enumerate(rooms):
    rid = sid()
    room_ids.append(rid)

    no = r['no']
    owner = users[r['owner']][0]
    sm = r['sm']
    rim = r.get('rim') if r.get('rim') is not None else 1
    tm = r.get('tm') if r.get('tm') is not None else 1
    zs = r.get('zs', 1)
    status = 1  # all archived
    all_record_json = json.dumps(r['all_record'], ensure_ascii=False).replace("'", "\\'")
    created = r['created']
    updated = r['updated']
    last_active = updated

    sql(f"INSERT INTO `room` (`id`,`room_no`,`owner_id`,`score_mode`,`round_input_method`,`trust_mode`,`zero_sum_required`,`status`,`all_record`,`last_active_at`,`created_at`,`updated_at`) VALUES ({rid},'{no}',{owner},{sm},{rim},{tm},{zs},{status},'{all_record_json}','{last_active}','{created}','{updated}');")

    # room_member
    settle_time = updated
    for midx in r['members']:
        mid = sid()
        muid = users[midx][0]
        fs = r['final'].get(midx, 0)
        joined = created
        sql(f"INSERT INTO `room_member` (`id`,`room_id`,`user_id`,`joined_at`,`quit_time`,`final_score`) VALUES ({mid},{rid},{muid},'{joined}','{settle_time}',{fs});")

# --- round_record + round_record_detail ---
round_seq = 2000000000000000
for ri, r in enumerate(rooms):
    if r['sm'] != 2:
        continue
    rid = room_ids[ri]
    for rd in r['rounds']:
        round_seq += 1
        rrid = round_seq
        total = sum(rd['scores'].values())
        created_by = users[rd['created_by']][0]
        created_at = rd['created_at']
        applied_at = rd['applied_at']

        sql(f"INSERT INTO `round_record` (`id`,`room_id`,`status`,`input_method`,`trust_mode`,`zero_sum_required`,`created_by`,`total_score`,`rejected_by`,`applied_at`,`created_at`) VALUES ({rrid},{rid},3,{r['rim']},{r['tm']},{r['zs']},{created_by},{total},NULL,'{applied_at}','{created_at}');")

        for midx, score in rd['scores'].items():
            detail_id = sid()
            muid = users[midx][0]
            sql(f"INSERT INTO `round_record_detail` (`id`,`round_record_id`,`user_id`,`score`) VALUES ({detail_id},{rrid},{muid},{score});")

# ============================================================
# Output
# ============================================================
print('\n'.join(lines))
