package com.cardgames.server.user;

import javax.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.*;

//class to manage a deck of cards, defined in the Card object
@Entity
@Table(name = "users")
public class User implements Serializable {

	private static final long serialVersionUID = 7663960497705998476L;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY )
	private int id;
	
	private String username;
	
	@Temporal(TemporalType.TIMESTAMP)
	private Date   datecreated;
	
	@Temporal(TemporalType.TIMESTAMP)
	private Date   lasthand;
	
	public User() {
		
		this.id = 0;
		this.username = "none";
		this.datecreated = User.getDefaultTime();
		this.lasthand = User.getDefaultTime();
	}
	
	public User( int id, String username, Date datecreated, Date lasthand) {
		
		this.id = id;
		this.username = username;
		this.datecreated = datecreated;
		this.lasthand = lasthand;
	}
	
	public User( String username, Date datecreated, Date lasthand) {
		
		this.username = username;
		this.datecreated = datecreated;
		this.lasthand = lasthand;
	}
	
	public int getId() {
		
		return this.id;
	}
	
	public void setId(int id) {
		this.id = id;
	}
	
	public String getUsername() {
		return this.username;
	}
	
	public void setUsername(String username) {
		this.username = username;
	}
	
	public Date getdatecreated() {
        return this.datecreated;
    }
 
    public void setdatecreated(Date datecreated) {
        this.datecreated = datecreated;
    }
    
    public Date getlasthand() {
        return this.lasthand;
    }
 
    public void setlasthand(Date lasthand) {
        this.lasthand = lasthand;
    }
    
    @Override
    public String toString() {
        return "User{" +
                "id=" + id +
                ", username:"+ username + ", datecreated:" + datecreated + ", lasthand:" + lasthand +
                '}';
    }
    
    static Date getDefaultTime() {
    	
    	Long epoch = Instant.EPOCH.toEpochMilli();
    	return new Date(epoch * 1000);
    }
}
