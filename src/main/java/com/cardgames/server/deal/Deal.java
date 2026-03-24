package com.cardgames.server.deal;

import java.io.Serializable;
import java.util.Date;
import javax.persistence.*;

//class to manage a deal of a deck including tracking number of moves it takes to solve, turn by turn moves, time taken and when played
@Entity
public class Deal implements Serializable {

	private static final long serialVersionUID = -4287758433956038359L;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY )
	private int id;
	
	@Temporal(TemporalType.TIMESTAMP)
	private Date dateplayed;
	
	private int moves;
	private int timeseconds;
	
	@Lob
	private String turns;
	
	private int deckid;
	private int userid;
	
	
	public Deal() {
		
		this.id = 0;
		this.dateplayed = new Date();
		this.moves = 0;
		this.timeseconds = 0;
		this.turns = "";
		this.deckid = 0;
		this.userid = 0;
	}
	
	public Deal(int id, Date dateplayed, int moves, int timeseconds, String turns, int deckid, int userid) {
	
		this.id = id;
		this.dateplayed = dateplayed;
		this.moves = moves;
		this.timeseconds = timeseconds;
		this.turns = turns;
		this.deckid = deckid;
		this.userid = userid;
	}
	
	public Deal(Date dateplayed, int moves, int timeseconds, String turns, int deckid, int userid) {
		
		this.dateplayed = dateplayed;
		this.moves = moves;
		this.timeseconds = timeseconds;
		this.turns = turns;
		this.deckid = deckid;
		this.userid = userid;
	}

	public int getId() {
		
		return this.id;
	}
	
	public void setId(int id) {
		this.id = id;
	}
	
	public Date getdateplayed() {
        return this.dateplayed;
    }
 
    public void setdateplayed(Date dateplayed) {
        this.dateplayed = dateplayed;
    }
    
    public int getmoves() {
		
		return this.moves;
	}
	
	public void setmoves(int moves) {
		this.moves = moves;
	}
	
	public int gettimeseconds() {
		
		return this.timeseconds;
	}
	
	public void settimeseconds(int timeseconds) {
		this.timeseconds = timeseconds;
	}
	
	public String getturns() {
		return this.turns;
	}
	
	public void setturns(String turns) {
		this.turns = turns;
	}
	
	public int getdeckid() {
		
		return this.deckid;
	}
	
	public void setdeckid(int deckid) {
		this.deckid = deckid;
	}

	public int getuserid() {
		
		return this.userid;
	}
	
	public void setuserid(int userid) {
		this.userid = userid;
	}
	
	@Override
    public String toString() {
        return "Deal{" +
                "id=" + id +
                ", dateplayed:"+ dateplayed + ", moves:" + moves + ", timeseconds:" + timeseconds +
                ", userid:" + userid + ", deckid:" + deckid + ", turns:"+ turns + '}';
    }
}
