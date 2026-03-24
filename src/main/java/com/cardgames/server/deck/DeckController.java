package com.cardgames.server.deck;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:4200" })

@RestController
public class DeckController {

    @Autowired
    DeckRepository deckRepository;
 
    @GetMapping("/deck/{id}")
    public Deck show(@PathVariable String id) {
    	
        int deckId = Integer.parseInt(id);      
        return deckRepository.findById(deckId);
    }
    
    @GetMapping("/deck/shuffle")
    public Deck shuffle() {
    	
        Deck deck = new Deck();      
        deck.shuffle();
        return deck;
    }
    
    @PostMapping("/deck")
    public Deck create(@RequestBody Map<String,Integer> body){
    	
        
    	Deck deck = createDeckFromMap(body);
        return deckRepository.save(deck);
    }
    
    @PostMapping("/deck/isDupe")
    public Deck isDupe(@RequestBody Map<String,Integer> body){
    	
    	Deck deck = createDeckFromMap(body);
    	
    	return deckRepository.findByCard1AndCard2AndCard3AndCard4AndCard5AndCard6AndCard7AndCard8AndCard9AndCard10AndCard11AndCard12AndCard13AndCard14AndCard15AndCard16AndCard17AndCard18AndCard19AndCard20AndCard21AndCard22AndCard23AndCard24AndCard25AndCard26AndCard27AndCard28AndCard29AndCard30AndCard31AndCard32AndCard33AndCard34AndCard35AndCard36AndCard37AndCard38AndCard39AndCard40AndCard41AndCard42AndCard43AndCard44AndCard45AndCard46AndCard47AndCard48AndCard49AndCard50AndCard51AndCard52(
    					deck.getCard1(), deck.getCard2(), deck.getCard3(), deck.getCard4(), deck.getCard5(), deck.getCard6(), deck.getCard7(), deck.getCard8(), deck.getCard9(), deck.getCard10(),
    					deck.getCard11(), deck.getCard12(), deck.getCard13(), deck.getCard14(), deck.getCard15(), deck.getCard16(), deck.getCard17(), deck.getCard18(), deck.getCard19(), deck.getCard20(),
    					deck.getCard21(), deck.getCard22(), deck.getCard23(), deck.getCard24(), deck.getCard25(), deck.getCard26(), deck.getCard27(), deck.getCard28(), deck.getCard29(), deck.getCard30(),
    					deck.getCard31(), deck.getCard32(), deck.getCard33(), deck.getCard34(), deck.getCard35(), deck.getCard36(), deck.getCard37(), deck.getCard38(), deck.getCard39(), deck.getCard40(),
    					deck.getCard41(), deck.getCard42(), deck.getCard43(), deck.getCard44(), deck.getCard45(), deck.getCard46(), deck.getCard47(), deck.getCard48(), deck.getCard49(), deck.getCard50(),
    					deck.getCard51(), deck.getCard52());
    }
    
    @PostMapping("/deck/description/{id}")
	 public ResponseEntity<Deck> saveDescription(@PathVariable String id, @RequestBody Map<String,String> body){
    	
    	int deckId = Integer.parseInt(id);      
    	String description = body.get("description");
    	Deck deck=null;
        
        try {
			 
			 deck = deckRepository.findById(deckId);
			 deck.setdescription(description);
			 deckRepository.save(deck);
			 
			 return new ResponseEntity<Deck>(deck, HttpStatus.OK);
			 
		 } catch (Exception e) {
			 
			 return new ResponseEntity<Deck>(deck, HttpStatus.BAD_REQUEST);
		 }
    }
    
    @PostMapping("/deck/solved/{id}")
	 public ResponseEntity<Deck> deckSolved(@PathVariable String id, @RequestBody Map<String,String> body){
   	
   	int deckId = Integer.parseInt(id);      
   	String description = body.get("description");
   	boolean issolved = true;
   	
   	Deck deck=null;
       
       try {
			 
			 deck = deckRepository.findById(deckId);
			 deck.setdescription(description);
			 deck.setissolved(issolved);
			 
			 deckRepository.save(deck);
			 
			 return new ResponseEntity<Deck>(deck, HttpStatus.OK);
			 
		 } catch (Exception e) {
			 
			 return new ResponseEntity<Deck>(deck, HttpStatus.BAD_REQUEST);
		 }
   }
   
    
    private Deck createDeckFromMap(Map<String,Integer> body) {
    	
    	int card1 = body.get("card1");
        int card2 = body.get("card2");
        int card3 = body.get("card3");
        int card4 = body.get("card4");
        int card5 = body.get("card5");
        int card6 = body.get("card6");
        int card7 = body.get("card7");
        int card8 = body.get("card8");
        int card9 = body.get("card9");
        int card10 = body.get("card10");
        
        int card11 = body.get("card11");
        int card12 = body.get("card12");
        int card13 = body.get("card13");
        int card14 = body.get("card14");
        int card15 = body.get("card15");
        int card16 = body.get("card16");
        int card17 = body.get("card17");
        int card18 = body.get("card18");
        int card19 = body.get("card19");
        int card20 = body.get("card20");
        
        int card21 = body.get("card21");
        int card22 = body.get("card22");
        int card23 = body.get("card23");
        int card24 = body.get("card24");
        int card25 = body.get("card25");
        int card26 = body.get("card26");
        int card27 = body.get("card27");
        int card28 = body.get("card28");
        int card29 = body.get("card29");
        int card30 = body.get("card30");
        
        int card31 = body.get("card31");
        int card32 = body.get("card32");
        int card33 = body.get("card33");
        int card34 = body.get("card34");
        int card35 = body.get("card35");
        int card36 = body.get("card36");
        int card37 = body.get("card37");
        int card38 = body.get("card38");
        int card39 = body.get("card39");
        int card40 = body.get("card40");
        
        int card41 = body.get("card41");
        int card42 = body.get("card42");
        int card43 = body.get("card43");
        int card44 = body.get("card44");
        int card45 = body.get("card45");
        int card46 = body.get("card46");
        int card47 = body.get("card47");
        int card48 = body.get("card48");
        int card49 = body.get("card49");
        int card50 = body.get("card50");
        
        int card51 = body.get("card51");
        int card52 = body.get("card52");
        
        boolean isSolved = false;
        String description = "Not Solved";
        
        return( new Deck( card1,   card2,   card3,   card4,   card5,   card6,   card7,   card8,   card9,   card10, 
				 card11,  card12,  card13,  card14,  card15,  card16,  card17,  card18,  card19,  card20,
				 card21,  card22,  card23,  card24,  card25,  card26,  card27,  card28,  card29,  card30,
				 card31,  card32,  card33,  card34,  card35,  card36,  card37,  card38,  card39,  card40,
				 card41,  card42,  card43,  card44,  card45,  card46,  card47,  card48,  card49,  card50, 
				 card51,  card52, isSolved, description));
    }
}