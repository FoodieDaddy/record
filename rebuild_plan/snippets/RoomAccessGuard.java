@Component
public class RoomAccessGuard {
    private final RoomMemberMapper roomMemberMapper;

    public RoomAccessGuard(RoomMemberMapper roomMemberMapper) {
        this.roomMemberMapper = roomMemberMapper;
    }

    public void assertRoomMember(Long roomId, Long userId) {
        if (roomId == null || userId == null) {
            throw new BizException(403, "无权访问该编队");
        }
        boolean exists = roomMemberMapper.existsActiveMember(roomId, userId);
        if (!exists) {
            throw new BizException(403, "无权访问该编队");
        }
    }
}
