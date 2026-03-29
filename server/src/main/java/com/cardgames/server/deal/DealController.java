package com.cardgames.server.deal;

import java.util.ArrayList;

import java.util.Date;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:4200", "http://localhost:5173", "http://13.60.243.134" })

@RestController
public class DealController {

	@Autowired
    DealRepository dealRepository;
	
	@GetMapping("/deal/{id}")
	public  ResponseEntity<Deal> show(@PathVariable String id) {
	    	
		int dealId = Integer.parseInt(id);      
		Deal deal = null;
		 
		try {
			 
			deal = dealRepository.findById(dealId);
			
		} catch(Exception e) {
			 
		}
		return new ResponseEntity<Deal>(deal, HttpStatus.OK);
	}

	
	@PostMapping("/deal")
	 public ResponseEntity<Deal> create(@RequestBody Map<String,String> body) {
		
		int moves = Integer.parseInt(body.get("moves"));
		int timeseconds = Integer.parseInt(body.get("timeseconds"));
		String turns = body.get("turns");
		int deckid = Integer.parseInt(body.get("deckid"));
		int userid = Integer.parseInt(body.get("userid"));
		
		Deal deal = new Deal(new Date(), moves, timeseconds, turns, deckid, userid);
		
		try {	
			 
			dealRepository.save(deal);
			 
		} catch (Exception e) {
			 
		}
		return new ResponseEntity<Deal>(deal, HttpStatus.OK);
	}
	
	@PostMapping("/deal/highscores/deck/moves")
	public ArrayList<Deal> highscoresDeck(@RequestBody Map<String,String> body) {
	    	
		int deckId = Integer.parseInt(body.get("deckid"));            
		int limit = Integer.parseInt(body.get("limit"));
		
		ArrayList<Deal> deals = new ArrayList<Deal>();   
		 
		try {
			
			deals = dealRepository.findTopMovesForADeck(deckId, limit);
			
		} catch(Exception e) {
			 
		}
		return deals;
	}
	
	@PostMapping("/deal/highscores/deck/times")
	public ArrayList<Deal> topTimesDeck(@RequestBody Map<String,String> body) {
	    	
		int deckId = Integer.parseInt(body.get("deckid"));      
		int limit = Integer.parseInt(body.get("limit"));
		
		ArrayList<Deal> deals = new ArrayList<Deal>();   
		 
		try {
			
			deals = dealRepository.findTopTimesForADeck(deckId, limit);
			
		} catch(Exception e) {
			 
		}
		return deals;
	}
	
	@PostMapping("/deal/highscores/user/moves")
	public ArrayList<Deal> highscoresUser(@RequestBody Map<String,String> body) {
	    	
		int userId = Integer.parseInt(body.get("userid"));            
		int limit = Integer.parseInt(body.get("limit"));
		
		ArrayList<Deal> deals = new ArrayList<Deal>();   
		 
		try {
			
			deals = dealRepository.findTopMovesForAUser(userId, limit);
			
		} catch(Exception e) {
			 
		}
		return deals;
	}
	
	@PostMapping("/deal/highscores/user/times")
	public ArrayList<Deal> topTimesUser(@RequestBody Map<String,String> body) {
	    	
		int userid = Integer.parseInt(body.get("userid"));      
		int limit = Integer.parseInt(body.get("limit"));
		
		ArrayList<Deal> deals = new ArrayList<Deal>();   
		 
		try {
			
			deals = dealRepository.findTopTimesForAUser(userid, limit);
			
		} catch(Exception e) {
			 
		}
		return deals;
	}
	
	//users top moves and times across all decks
	
}
