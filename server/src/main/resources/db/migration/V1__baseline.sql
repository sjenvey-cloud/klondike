-- V1__baseline.sql
-- Baseline schema for Klondike Solitaire
-- Captures the initial tables: users, deck, deal

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(255),
    datecreated TIMESTAMP,
    lasthand    TIMESTAMP
);

CREATE TABLE deck (
    id          SERIAL PRIMARY KEY,
    card1       INTEGER NOT NULL,
    card2       INTEGER NOT NULL,
    card3       INTEGER NOT NULL,
    card4       INTEGER NOT NULL,
    card5       INTEGER NOT NULL,
    card6       INTEGER NOT NULL,
    card7       INTEGER NOT NULL,
    card8       INTEGER NOT NULL,
    card9       INTEGER NOT NULL,
    card10      INTEGER NOT NULL,
    card11      INTEGER NOT NULL,
    card12      INTEGER NOT NULL,
    card13      INTEGER NOT NULL,
    card14      INTEGER NOT NULL,
    card15      INTEGER NOT NULL,
    card16      INTEGER NOT NULL,
    card17      INTEGER NOT NULL,
    card18      INTEGER NOT NULL,
    card19      INTEGER NOT NULL,
    card20      INTEGER NOT NULL,
    card21      INTEGER NOT NULL,
    card22      INTEGER NOT NULL,
    card23      INTEGER NOT NULL,
    card24      INTEGER NOT NULL,
    card25      INTEGER NOT NULL,
    card26      INTEGER NOT NULL,
    card27      INTEGER NOT NULL,
    card28      INTEGER NOT NULL,
    card29      INTEGER NOT NULL,
    card30      INTEGER NOT NULL,
    card31      INTEGER NOT NULL,
    card32      INTEGER NOT NULL,
    card33      INTEGER NOT NULL,
    card34      INTEGER NOT NULL,
    card35      INTEGER NOT NULL,
    card36      INTEGER NOT NULL,
    card37      INTEGER NOT NULL,
    card38      INTEGER NOT NULL,
    card39      INTEGER NOT NULL,
    card40      INTEGER NOT NULL,
    card41      INTEGER NOT NULL,
    card42      INTEGER NOT NULL,
    card43      INTEGER NOT NULL,
    card44      INTEGER NOT NULL,
    card45      INTEGER NOT NULL,
    card46      INTEGER NOT NULL,
    card47      INTEGER NOT NULL,
    card48      INTEGER NOT NULL,
    card49      INTEGER NOT NULL,
    card50      INTEGER NOT NULL,
    card51      INTEGER NOT NULL,
    card52      INTEGER NOT NULL,
    issolved    BOOLEAN NOT NULL DEFAULT FALSE,
    description VARCHAR(255)
);

CREATE TABLE deal (
    id          SERIAL PRIMARY KEY,
    dateplayed  TIMESTAMP,
    moves       INTEGER NOT NULL DEFAULT 0,
    timeseconds INTEGER NOT NULL DEFAULT 0,
    turns       TEXT,
    deckid      INTEGER NOT NULL DEFAULT 0,
    userid      INTEGER NOT NULL DEFAULT 0
);
