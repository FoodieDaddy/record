-- MySQL dump 10.13  Distrib 8.0.46, for Linux (aarch64)
--
-- Host: localhost    Database: smartrecord
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `fortune_log`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fortune_log` (
  `id` bigint NOT NULL,
  `user_id` bigint NOT NULL COMMENT 'ç”¨æˆ·ID',
  `user_tag` varchar(20) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '' COMMENT 'ç”¨æˆ·ç”»åƒæ ‡ç­¾',
  `source` varchar(10) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '' COMMENT 'æ•°æ®æ¥æº: llm / fallback',
  `model` varchar(64) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '' COMMENT 'LLM æ¨¡åž‹åç§°',
  `prompt` text COLLATE utf8mb4_general_ci COMMENT 'ç”¨æˆ· prompt å†…å®¹',
  `system_prompt` text COLLATE utf8mb4_general_ci COMMENT 'ç³»ç»Ÿæç¤ºè¯',
  `raw_response` text COLLATE utf8mb4_general_ci COMMENT 'LLM åŽŸå§‹å“åº” / fallback æè¿°',
  `result_json` text COLLATE utf8mb4_general_ci COMMENT 'æœ€ç»ˆ FortuneResp JSON',
  `duration_ms` int NOT NULL DEFAULT '0' COMMENT 'è°ƒç”¨è€—æ—¶(æ¯«ç§’)',
  `success` tinyint NOT NULL DEFAULT '1' COMMENT 'æ˜¯å¦æˆåŠŸ: 1=æˆåŠŸ 0=å¤±è´¥',
  `error_msg` varchar(500) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '' COMMENT 'é”™è¯¯ä¿¡æ¯',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ç­–ç•¥ç”Ÿæˆæ—¥å¿—';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mirror_birth_profile`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mirror_birth_profile` (
  `user_id` bigint NOT NULL COMMENT 'ç”¨æˆ·ID',
  `calendar_type` varchar(16) DEFAULT 'solar' COMMENT 'åŽ†æ³•: solar/lunar',
  `birth_date` date DEFAULT NULL COMMENT 'å‡ºç”Ÿæ—¥æœŸ',
  `birth_time` varchar(16) DEFAULT NULL COMMENT 'å‡ºç”Ÿæ—¶é—´(HH:mm)',
  `birth_place` varchar(128) DEFAULT NULL COMMENT 'å‡ºç”Ÿåœ°',
  `timezone` varchar(64) DEFAULT 'Asia/Shanghai' COMMENT 'æ—¶åŒº',
  `gender` varchar(16) DEFAULT NULL COMMENT 'æ€§åˆ«',
  `extra_json` json DEFAULT NULL COMMENT 'æ‰©å±•å­—æ®µ',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='å‡ºç”Ÿæ¡£æ¡ˆ';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `room`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `room` (
  `id` bigint NOT NULL COMMENT 'é›ªèŠ± ID',
  `room_no` varchar(8) NOT NULL COMMENT 'å”¯ä¸€æˆ¿é—´å·',
  `owner_id` bigint NOT NULL COMMENT 'æˆ¿ä¸»',
  `score_mode` tinyint NOT NULL DEFAULT '1' COMMENT 'è®°åˆ†æ¨¡å¼ï¼š1-è‡ªç”±æµè½¬ 2-èµ¢å®¶ç»Ÿå½•',
  `round_input_method` int DEFAULT '1' COMMENT 'æœ¬å±€å½•å…¥æ–¹å¼ï¼š1-æˆ¿ä¸»å¡«å†™ 2-æˆå‘˜è‡ªå¡«',
  `trust_mode` int DEFAULT '0' COMMENT 'ä¿¡ä»»æ¨¡å¼ï¼š0-å…³é—­ 1-å¼€å¯',
  `zero_sum_required` int DEFAULT '0' COMMENT 'é›¶å’Œæ¨¡å¼ï¼š0-å…³é—­ 1-å¼€å¯',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0-ä½¿ç”¨ä¸­ 1-å·²å½’æ¡£',
  `all_record` json DEFAULT NULL COMMENT 'å¯¹å±€æµæ°´æ˜Žç»†ï¼ˆsettle æ—¶å½’æ¡£ï¼‰',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_active_at` datetime DEFAULT NULL COMMENT 'æœ€åŽä¸€æ¬¡è®°åˆ†/è½¬è´¦æ—¶é—´',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_no` (`room_no`),
  KEY `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='æˆ¿é—´è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `room_member`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `room_member` (
  `id` bigint NOT NULL COMMENT 'é›ªèŠ± ID',
  `room_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `quit_time` datetime DEFAULT NULL COMMENT 'é€€å‡º/ç»“ç®—æ—¶é—´',
  `final_score` int DEFAULT NULL COMMENT 'è¯¥ç”¨æˆ·æœ¬å±€æœ€ç»ˆå‡€èƒœåˆ†',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_user` (`room_id`,`user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='æˆ¿é—´æˆå‘˜è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `round_record`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `round_record` (
  `id` bigint NOT NULL,
  `room_id` bigint NOT NULL,
  `status` int NOT NULL DEFAULT '1' COMMENT '1-PENDING_MEMBER_INPUT 2-PENDING_CONFIRM 3-APPLIED 4-REJECTED 5-CANCELLED',
  `input_method` int NOT NULL DEFAULT '1' COMMENT '1-æˆ¿ä¸»å¡«å†™ 2-æˆå‘˜è‡ªå¡«',
  `trust_mode` int NOT NULL DEFAULT '0' COMMENT '0-å…³é—­ 1-å¼€å¯',
  `zero_sum_required` int NOT NULL DEFAULT '0' COMMENT '0-å…³é—­ 1-å¼€å¯',
  `created_by` bigint NOT NULL,
  `total_score` int DEFAULT NULL,
  `rejected_by` bigint DEFAULT NULL,
  `applied_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_room_id` (`room_id`),
  KEY `idx_room_status` (`room_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='å±€è®°å½•';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `round_record_detail`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `round_record_detail` (
  `id` bigint NOT NULL,
  `round_record_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `score` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_round_record_id` (`round_record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='å±€è®°å½•æ˜Žç»†';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` bigint NOT NULL COMMENT 'é›ªèŠ± ID',
  `openid` varchar(64) NOT NULL COMMENT 'å¾®ä¿¡ openid',
  `unionid` varchar(64) DEFAULT NULL COMMENT 'å¾®ä¿¡ unionid',
  `nickname` varchar(64) NOT NULL DEFAULT '' COMMENT 'æ˜µç§°',
  `avatar_url` varchar(512) NOT NULL DEFAULT '' COMMENT 'å¤´åƒ URL',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT 'è´¦å·çŠ¶æ€ 0-æ­£å¸¸ 1-å°ç¦ 2-å·²æ³¨é”€',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ç”¨æˆ·è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_detail`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_detail` (
  `id` bigint NOT NULL COMMENT 'ä¸Ž user.id ç›¸åŒ',
  `voice_enabled` tinyint NOT NULL DEFAULT '1' COMMENT 'è¯­éŸ³æ’­æŠ¥ 0-å…³ 1-å¼€',
  `voice_id` varchar(64) DEFAULT 'std_01' COMMENT 'éŸ³è‰² ID',
  `anim_enabled` tinyint NOT NULL DEFAULT '1' COMMENT 'åŠ¨ç”» 0-å…³ 1-å¼€',
  `vibrate_enabled` tinyint NOT NULL DEFAULT '1' COMMENT 'éœ‡åŠ¨ 0-å…³ 1-å¼€',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ç”¨æˆ·è¯¦æƒ…/è®¾ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_identity_level`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_identity_level` (
  `user_id` bigint NOT NULL COMMENT 'ç”¨æˆ·ID',
  `level` int NOT NULL DEFAULT '1' COMMENT 'ç­‰çº§ 1-5',
  `exp` int NOT NULL DEFAULT '0' COMMENT 'ç»éªŒå€¼',
  `stability` int DEFAULT NULL COMMENT 'äººæ ¼ç¨³å®šåº¦ 0-100',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_identity_level_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ç”¨æˆ·èº«ä»½ç­‰çº§';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_mirror_profile`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_mirror_profile` (
  `user_id` bigint NOT NULL COMMENT 'ç”¨æˆ·ID',
  `mbti_code` int DEFAULT '0',
  `mbti_source` varchar(16) DEFAULT NULL COMMENT 'æ¥æº: test/direct',
  `mbti_confidence` decimal(5,2) DEFAULT NULL COMMENT 'ç½®ä¿¡åº¦ 0-100',
  `mbti_test_version` varchar(32) DEFAULT NULL COMMENT 'æµ‹è¯•ç‰ˆæœ¬',
  `mbti_answers_json` json DEFAULT NULL COMMENT 'æµ‹è¯•åŽŸå§‹ç­”æ¡ˆ',
  `battle_persona_tag` varchar(64) DEFAULT NULL COMMENT 'æˆ˜ç»©äººæ ¼æ ‡ç­¾',
  `battle_persona_title` varchar(64) DEFAULT NULL COMMENT 'æˆ˜ç»©äººæ ¼æ ‡é¢˜',
  `battle_persona_summary` text COMMENT 'æˆ˜ç»©äººæ ¼æè¿°',
  `battle_persona_json` json DEFAULT NULL COMMENT 'ç”»åƒè¯¦ç»†æ•°æ®',
  `sample_size` int DEFAULT '0' COMMENT 'æ ·æœ¬æ•°',
  `persona_calculated_at` datetime DEFAULT NULL COMMENT 'ç”»åƒè®¡ç®—æ—¶é—´',
  `calibrated_at` datetime DEFAULT NULL COMMENT 'æ ¡å‡†æ—¶é—´',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='MBTIåšå¼ˆäººæ ¼æ ¡å‡†';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'smartrecord'
--
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`%` PROCEDURE `TruncateAllTables`()
BEGIN
    -- 定义变量
    DECLARE done INT DEFAULT FALSE;
    DECLARE current_table_name VARCHAR(255);
    
    -- 声明游标：从 information_schema 获取当前数据库下的所有基础表（排除视图）
    DECLARE table_cursor CURSOR FOR 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';
        
    -- 声明游标结束时的处理程序
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- 1. 极其重要：临时关闭外键约束检查，否则有外键关联的表会清理失败
    SET FOREIGN_KEY_CHECKS = 0;

    -- 打开游标
    OPEN table_cursor;

    -- 开始循环
    truncate_loop: LOOP
        FETCH table_cursor INTO current_table_name;
        
        -- 如果游标遍历结束，退出循环
        IF done THEN
            LEAVE truncate_loop;
        END IF;

        -- 2. 构建动态 SQL
        -- 使用 TRUNCATE 清空表并重置自增主键。
        SET @drop_stmt = CONCAT('TRUNCATE TABLE `', current_table_name, '`');
        
        -- 准备并执行动态 SQL
        PREPARE stmt FROM @drop_stmt;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
    END LOOP;

    -- 关闭游标
    CLOSE table_cursor;

    -- 3. 恢复外键约束检查
    SET FOREIGN_KEY_CHECKS = 1;
    
    -- 输出完成提示
    SELECT '当前数据库的所有表数据已全部清空，并已重置自增主键。' AS Execution_Result;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-09  3:51:07
