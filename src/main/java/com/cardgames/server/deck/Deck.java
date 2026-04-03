package com.cardgames.server.deck;

import jakarta.persistence.*;

import java.io.Serializable;
import java.util.*;

//class to manage a deck of cards, defined in the Card object
@Entity
public class Deck implements Serializable {
	
	private static final long serialVersionUID = -3288326902891787350L;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY )
	private int id;
	
	private int card1;
	private int card2;
	private int card3;
	private int card4;
	private int card5;
	private int card6;
	private int card7;
	private int card8;
	private int card9;
	private int card10;
	private int card11;
	private int card12;
	private int card13;
	private int card14;
	private int card15;
	private int card16;
	private int card17;
	private int card18;
	private int card19;
	private int card20;
	private int card21;
	private int card22;
	private int card23;
	private int card24;
	private int card25;
	private int card26;
	private int card27;
	private int card28;
	private int card29;
	private int card30;
	private int card31;
	private int card32;
	private int card33;
	private int card34;
	private int card35;
	private int card36;
	private int card37;
	private int card38;
	private int card39;
	private int card40;
	private int card41;
	private int card42;
	private int card43;
	private int card44;
	private int card45;
	private int card46;
	private int card47;
	private int card48;
	private int card49;
	private int card50;
	private int card51;
	private int card52;
	
	private boolean issolved;
	private String description;
	
	public Deck() {
	
		//constructor used to create an ordered deck
		newDeck();
	}
	
	public Deck(int id, int card1, int card2, int card3, int card4,int card5, int card6, int card7, int card8, int card9, int card10,
						int card11, int card12, int card13, int card14, int card15, int card16, int card17, int card18, int card19, int card20,
						int card21, int card22, int card23, int card24, int card25, int card26, int card27, int card28, int card29, int card30,
						int card31, int card32, int card33, int card34, int card35, int card36, int card37, int card38, int card39, int card40,
						int card41, int card42, int card43, int card44, int card45, int card46, int card47, int card48, int card49, int card50, 
						int card51, int card52, boolean issolved, String description ) {
		
		this.id = id;
		
		this.card1=card1;
		this.card2=card2;
		this.card3=card3;
		this.card4=card4;
		this.card5=card5;
		this.card6=card6;
		this.card7=card7;
		this.card8=card8;
		this.card9=card9;
		this.card10=card10;
		this.card11=card11;
		this.card12=card12;
		this.card13=card13;
		this.card14=card14;
		this.card15=card15;
		this.card16=card16;
		this.card17=card17;
		this.card18=card18;
		this.card19=card19;
		this.card20=card20;
		this.card21=card21;
		this.card22=card22;
		this.card23=card23;
		this.card24=card24;
		this.card25=card25;
		this.card26=card26;
		this.card27=card27;
		this.card28=card28;
		this.card29=card29;
		this.card30=card30;
		this.card31=card31;
		this.card32=card32;
		this.card33=card33;
		this.card34=card34;
		this.card35=card35;
		this.card36=card36;
		this.card37=card37;
		this.card38=card38;
		this.card39=card39;
		this.card40=card40;
		this.card41=card41;
		this.card42=card42;
		this.card43=card43;
		this.card44=card44;
		this.card45=card45;
		this.card46=card46;
		this.card47=card47;
		this.card48=card48;
		this.card49=card49;
		this.card50=card50;
		this.card51=card51;
		this.card52=card52;
		
		this.issolved = issolved;
		this.description = description;
	}
	
	public Deck(int card1, int card2, int card3, int card4,int card5, int card6, int card7, int card8, int card9, int card10,
			int card11, int card12, int card13, int card14, int card15, int card16, int card17, int card18, int card19, int card20,
			int card21, int card22, int card23, int card24, int card25, int card26, int card27, int card28, int card29, int card30,
			int card31, int card32, int card33, int card34, int card35, int card36, int card37, int card38, int card39, int card40,
			int card41, int card42, int card43, int card44, int card45, int card46, int card47, int card48, int card49, int card50, 
			int card51, int card52, boolean issolved, String description ) {

		this.card1=card1;
		this.card2=card2;
		this.card3=card3;
		this.card4=card4;
		this.card5=card5;
		this.card6=card6;
		this.card7=card7;
		this.card8=card8;
		this.card9=card9;
		this.card10=card10;
		this.card11=card11;
		this.card12=card12;
		this.card13=card13;
		this.card14=card14;
		this.card15=card15;
		this.card16=card16;
		this.card17=card17;
		this.card18=card18;
		this.card19=card19;
		this.card20=card20;
		this.card21=card21;
		this.card22=card22;
		this.card23=card23;
		this.card24=card24;
		this.card25=card25;
		this.card26=card26;
		this.card27=card27;
		this.card28=card28;
		this.card29=card29;
		this.card30=card30;
		this.card31=card31;
		this.card32=card32;
		this.card33=card33;
		this.card34=card34;
		this.card35=card35;
		this.card36=card36;
		this.card37=card37;
		this.card38=card38;
		this.card39=card39;
		this.card40=card40;
		this.card41=card41;
		this.card42=card42;
		this.card43=card43;
		this.card44=card44;
		this.card45=card45;
		this.card46=card46;
		this.card47=card47;
		this.card48=card48;
		this.card49=card49;
		this.card50=card50;
		this.card51=card51;
		this.card52=card52;
		
		this.issolved = issolved;
		this.description = description;
	}
	
	public int getId() {
		
		return this.id;
	}
	
	public void setId(int id) {
		this.id = id;
	}
	
	public int getCard1() {
		return this.card1;
	}

	public void setCard1(int card) {
		this.card1 = card;
	}
	
	public int getCard2() {
		return this.card2;
	}

	public void setCard2(int card) {
		this.card2 = card;
	}
	
	public int getCard3() {
		return this.card3;
	}

	public void setCard3(int card) {
		this.card3 = card;
	}
	
	public int getCard4() {
		return this.card4;
	}

	public void setCard4(int card) {
		this.card4 = card;
	}
	
	public int getCard5() {
		return this.card5;
	}

	public void setCard5(int card) {
		this.card5 = card;
	}
	
	public int getCard6() {
		return this.card6;
	}

	public void setCard6(int card) {
		this.card6 = card;
	}
	
	public int getCard7() {
		return this.card7;
	}

	public void setCard7(int card) {
		this.card7 = card;
	}
	
	public int getCard8() {
		return this.card8;
	}

	public void setCard8(int card) {
		this.card8 = card;
	}
	
	public int getCard9() {
		return this.card9;
	}

	public void setCard9(int card) {
		this.card9 = card;
	}
	
	public int getCard10() {
		return this.card10;
	}

	public void setCard10(int card) {
		this.card10 = card;
	}
	
	public int getCard11() {
		return this.card11;
	}

	public void setCard11(int card) {
		this.card11 = card;
	}
	
	public int getCard12() {
		return this.card12;
	}

	public void setCard12(int card) {
		this.card12 = card;
	}
	
	public int getCard13() {
		return this.card13;
	}

	public void setCard13(int card) {
		this.card13 = card;
	}
	
	public int getCard14() {
		return this.card14;
	}

	public void setCard14(int card) {
		this.card14 = card;
	}
	
	public int getCard15() {
		return this.card15;
	}

	public void setCard15(int card) {
		this.card15 = card;
	}
	
	public int getCard16() {
		return this.card16;
	}

	public void setCard16(int card) {
		this.card16 = card;
	}
	
	public int getCard17() {
		return this.card17;
	}

	public void setCard17(int card) {
		this.card17 = card;
	}
	
	public int getCard18() {
		return this.card18;
	}

	public void setCard18(int card) {
		this.card18 = card;
	}
	
	public int getCard19() {
		return this.card19;
	}

	public void setCard19(int card) {
		this.card19 = card;
	}
	
	public int getCard20() {
		return this.card20;
	}

	public void setCard20(int card) {
		this.card20 = card;
	}
	
	public int getCard21() {
		return this.card21;
	}

	public void setCard21(int card) {
		this.card21 = card;
	}
	
	public int getCard22() {
		return this.card22;
	}

	public void setCard22(int card) {
		this.card22 = card;
	}
	
	public int getCard23() {
		return this.card23;
	}

	public void setCard23(int card) {
		this.card23 = card;
	}
	
	public int getCard24() {
		return this.card24;
	}

	public void setCard24(int card) {
		this.card24 = card;
	}
	
	public int getCard25() {
		return this.card25;
	}

	public void setCard25(int card) {
		this.card25 = card;
	}
	
	public int getCard26() {
		return this.card26;
	}

	public void setCard26(int card) {
		this.card26 = card;
	}
	
	public int getCard27() {
		return this.card27;
	}

	public void setCard27(int card) {
		this.card27 = card;
	}
	
	public int getCard28() {
		return this.card28;
	}

	public void setCard28(int card) {
		this.card28 = card;
	}
	
	public int getCard29() {
		return this.card29;
	}

	public void setCard29(int card) {
		this.card29 = card;
	}
	
	public int getCard30() {
		return this.card30;
	}

	public void setCard30(int card) {
		this.card30 = card;
	}
	
	public int getCard31() {
		return this.card31;
	}

	public void setCard31(int card) {
		this.card31 = card;
	}
	
	public int getCard32() {
		return this.card32;
	}

	public void setCard32(int card) {
		this.card32 = card;
	}
	
	public int getCard33() {
		return this.card33;
	}

	public void setCard33(int card) {
		this.card33 = card;
	}
	
	public int getCard34() {
		return this.card34;
	}

	public void setCard34(int card) {
		this.card34 = card;
	}
	
	public int getCard35() {
		return this.card35;
	}

	public void setCard35(int card) {
		this.card35 = card;
	}
	
	public int getCard36() {
		return this.card36;
	}

	public void setCard36(int card) {
		this.card36 = card;
	}
	
	public int getCard37() {
		return this.card37;
	}

	public void setCard37(int card) {
		this.card37 = card;
	}
	
	public int getCard38() {
		return this.card38;
	}

	public void setCard38(int card) {
		this.card38 = card;
	}
	
	public int getCard39() {
		return this.card39;
	}

	public void setCard39(int card) {
		this.card39 = card;
	}
	
	public int getCard40() {
		return this.card40;
	}

	public void setCard40(int card) {
		this.card40 = card;
	}
	
	public int getCard41() {
		return this.card41;
	}

	public void setCard41(int card) {
		this.card41 = card;
	}
	
	public int getCard42() {
		return this.card42;
	}

	public void setCard42(int card) {
		this.card42 = card;
	}
	
	public int getCard43() {
		return this.card43;
	}

	public void setCard43(int card) {
		this.card43 = card;
	}
	
	public int getCard44() {
		return this.card44;
	}

	public void setCard44(int card) {
		this.card44 = card;
	}
	
	public int getCard45() {
		return this.card45;
	}

	public void setCard45(int card) {
		this.card45 = card;
	}
	
	public int getCard46() {
		return this.card46;
	}

	public void setCard46(int card) {
		this.card46 = card;
	}
	
	public int getCard47() {
		return this.card47;
	}

	public void setCard47(int card) {
		this.card47 = card;
	}
	
	public int getCard48() {
		return this.card48;
	}

	public void setCard48(int card) {
		this.card48 = card;
	}
	
	public int getCard49() {
		return this.card49;
	}

	public void setCard49(int card) {
		this.card49 = card;
	}
	
	public int getCard50() {
		return this.card50;
	}

	public void setCard50(int card) {
		this.card50 = card;
	}
	
	public int getCard51() {
		return this.card51;
	}

	public void setCard51(int card) {
		this.card51 = card;
	}
	
	public int getCard52() {
		return this.card52;
	}

	public void setCard52(int card) {
		this.card52 = card;
	}
	
	public boolean getissolved() {
		return this.issolved;
	}

	public void setissolved(boolean issolved) {
		this.issolved = issolved;
	}
	
	public String getdescription() {
		return this.description;
	}
	
	public void setdescription(String description) {
		this.description = description;
	}
	
	//creates a new randomized deck, id will be set to -1 as it has not been saved to the DB yet
	public void shuffle() {
		
		newDeck();
		this.id = -1;
		ArrayList<Integer> cards = new ArrayList<>();
		
		cards.add(card1);
		cards.add(card2);
		cards.add(card3);
		cards.add(card4);
		cards.add(card5);
		cards.add(card6);
		cards.add(card7);
		cards.add(card8);
		cards.add(card9);
		cards.add(card10);
		cards.add(card11);
		cards.add(card12);
		cards.add(card13);
		cards.add(card14);
		cards.add(card15);
		cards.add(card16);
		cards.add(card17);
		cards.add(card18);
		cards.add(card19);
		cards.add(card20);
		cards.add(card21);
		cards.add(card22);
		cards.add(card23);
		cards.add(card24);
		cards.add(card25);
		cards.add(card26);
		cards.add(card27);
		cards.add(card28);
		cards.add(card29);
		cards.add(card30);
		cards.add(card31);
		cards.add(card32);
		cards.add(card33);
		cards.add(card34);
		cards.add(card35);
		cards.add(card36);
		cards.add(card37);
		cards.add(card38);
		cards.add(card39);
		cards.add(card40);
		cards.add(card41);
		cards.add(card42);
		cards.add(card43);
		cards.add(card44);
		cards.add(card45);
		cards.add(card46);
		cards.add(card47);
		cards.add(card48);
		cards.add(card49);
		cards.add(card50);
		cards.add(card51);
		cards.add(card52);
		
		Collections.shuffle(cards);
		
		card1 = cards.get(0);
		card2 = cards.get(1);
		card3 = cards.get(2);
		card4 = cards.get(3);
		card5 = cards.get(4);
		card6 = cards.get(5);
		card7 = cards.get(6);
		card8 = cards.get(7);
		card9 = cards.get(8);
		card10 = cards.get(9);
		card11 = cards.get(10);
		card12 = cards.get(11);
		card13 = cards.get(12);
		card14 = cards.get(13);
		card15 = cards.get(14);
		card16 = cards.get(15);
		card17 = cards.get(16);
		card18 = cards.get(17);
		card19 = cards.get(18);
		card20 = cards.get(19);
		card21 = cards.get(20);
		card22 = cards.get(21);
		card23 = cards.get(22);
		card24 = cards.get(23);
		card25 = cards.get(24);
		card26 = cards.get(25);
		card27 = cards.get(26);
		card28 = cards.get(27);
		card29 = cards.get(28);
		card30 = cards.get(29);
		card31 = cards.get(30);
		card32 = cards.get(31);
		card33 = cards.get(32);
		card34 = cards.get(33);
		card35 = cards.get(34);
		card36 = cards.get(35);
		card37 = cards.get(36);
		card38 = cards.get(37);
		card39 = cards.get(38);
		card40 = cards.get(39);
		card41 = cards.get(40);
		card42 = cards.get(41);
		card43 = cards.get(42);
		card44 = cards.get(43);
		card45 = cards.get(44);
		card46 = cards.get(45);
		card47 = cards.get(46);
		card48 = cards.get(47);
		card49 = cards.get(48);
		card50 = cards.get(49);
		card51 = cards.get(50);
		card52 = cards.get(51);
	}
	
	//create a deck ordered and suites, Hearts, Diamonds, Clubs and Spades, id set to 0, the default deck
	public void newDeck() {
		
		this.id = 0;
		
		card1=1;
		card2=2;
		card3=3;
		card4=4;
		card5=5;
		card6=6;
		card7=7;
		card8=8;
		card9=9;
		card10=10;
		card11=11;
		card12=12;
		card13=13;
		card14=14;
		card15=15;
		card16=16;
		card17=17;
		card18=18;
		card19=19;
		card20=20;
		card21=21;
		card22=22;
		card23=23;
		card24=24;
		card25=25;
		card26=26;
		card27=27;
		card28=28;
		card29=29;
		card30=30;
		card31=31;
		card32=32;
		card33=33;
		card34=34;
		card35=35;
		card36=36;
		card37=37;
		card38=38;
		card39=39;
		card40=40;
		card41=41;
		card42=42;
		card43=43;
		card44=44;
		card45=45;
		card46=46;
		card47=47;
		card48=48;
		card49=49;
		card50=50;
		card51=51;
		card52=52;
		
		this.issolved = false;
		this.description = "Not Solved";
	}
	
	@Override
    public String toString() {
        return "Deck{" +
                "id=" + id +
                ", cards={card1:"+ card1 + ", card2:" + card2 + ", card3:" + card3 + ", card4:" + card4 + ", card5:" + card5 + ", card6:" + card6 + ", card7:" + card7 + 
                ", card8:" + card8 + ", card9:" + card9 + ", card10:" + card10 + ", card11:" + card11 + ", card12:" + card12 + ", card13:" + card13 + ", card14:" + card14 +
                ", card15:" + card15 + ", card16:" + card16 + ", card17:" + card17 + ", card18:" + card18 + ", card19:" + card19 + ", card20:" + card20 + ", card21:" + card21 + 
                ", card22:" + card22 + ", card23:" + card23 + ", card24:" + card24 + ", card25:" + card25 + ", card26:" + card26 + ", card27:" + card27 + ", card28:" + card28 + 
                ", card29:" + card29 + ", card30:" + card30 + ", card31:" + card31 + ", card32:" + card32 + ", card33:" + card33 + ", card34:" + card34 + ", card35:" + card35 + 
                ", card36:" + card36 + ", card37:" + card37 + ", card38:" + card38 + ", card39:" + card39 + ", card40:" + card40 + ", card41:" + card41 + ", card42:" + card42 + 
                ", card43:" + card43 + ", card44:" + card44 + ", card45:" + card45 + ", card46:" + card46 + ", card47:" + card47 + ", card48:" + card48 + ", card49:" + card49 + 
                ", card50:" + card50 + ", card51:" + card51 + ", card52:" + card52 +'}' +
                ", issolved:" + issolved + ", description:" + description +'}';
    }
}