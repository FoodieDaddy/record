package com.smartrecord;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

public class Repair {
    public static void main(String[] args) throws Exception {
        Connection conn = DriverManager.getConnection("jdbc:mysql://localhost:13306/smartrecord?useSSL=false", "root", "root123");
        Statement stmt = conn.createStatement();
        stmt.execute("DELETE FROM flyway_schema_history WHERE version='5'");
        System.out.println("Repaired!");
    }
}
