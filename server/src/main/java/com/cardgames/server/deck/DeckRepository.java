package com.cardgames.server.deck;

import java.util.ArrayList;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.cardgames.server.deal.Deal;


@Repository
public interface DeckRepository extends JpaRepository<Deck, Integer> {

	Deck findByCard1AndCard2AndCard3AndCard4AndCard5AndCard6AndCard7AndCard8AndCard9AndCard10AndCard11AndCard12AndCard13AndCard14AndCard15AndCard16AndCard17AndCard18AndCard19AndCard20AndCard21AndCard22AndCard23AndCard24AndCard25AndCard26AndCard27AndCard28AndCard29AndCard30AndCard31AndCard32AndCard33AndCard34AndCard35AndCard36AndCard37AndCard38AndCard39AndCard40AndCard41AndCard42AndCard43AndCard44AndCard45AndCard46AndCard47AndCard48AndCard49AndCard50AndCard51AndCard52(int card1, int card2, int card3, int card4,int card5, int card6, int card7, int card8, int card9, int card10,
			int card11, int card12, int card13, int card14, int card15, int card16, int card17, int card18, int card19, int card20,
			int card21, int card22, int card23, int card24, int card25, int card26, int card27, int card28, int card29, int card30,
			int card31, int card32, int card33, int card34, int card35, int card36, int card37, int card38, int card39, int card40,
			int card41, int card42, int card43, int card44, int card45, int card46, int card47, int card48, int card49, int card50, 
			int card51, int card52);
	
	Deck findById(int id);
}
