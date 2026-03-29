package com.cardgames.server.user;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:4200", "http://localhost:5173", "http://13.60.243.134" })

@RestController
public class UserController {

	 @Autowired
     UserRepository userRepository;
	
	 @GetMapping("/user/all")
     public List<User> getUsers() {
         return userRepository.findAll();
     }
	
	 @GetMapping("/user/{id}")
	 public  ResponseEntity<User> show(@PathVariable String id) {
	    	
		 int userId = Integer.parseInt(id);      
		 User user = new User();
		 
		 try {
			 
			 user = userRepository.findById(userId);
			 return new ResponseEntity<User>(user, HttpStatus.OK);
			 
		 } catch(Exception e) {
			 
			 return new ResponseEntity<User>(user, HttpStatus.BAD_REQUEST);
		 }
	 }
	 
	 @GetMapping("/user/username/{username}")
	 public ResponseEntity<User> showUsername(@PathVariable String username) {
		 
		 User user = new User();
		 
		 try {
			 
			 user = userRepository.findByUsername(username);
			 return new ResponseEntity<User>(user, HttpStatus.OK);
			 
		 } catch(Exception e) {
			 
			 return new ResponseEntity<User>(user, HttpStatus.BAD_REQUEST);
		 }
	 }
	 
	 @PostMapping("/user")
	 public ResponseEntity<User> create(@RequestBody Map<String,String> body){
	    	
		 String username = body.get("username");
		 User user = new User(username, new Date(), User.getDefaultTime());
		 
		 try {	
			 userRepository.save(user);
			 return new ResponseEntity<User>(user, HttpStatus.OK);
			 
		 } catch (Exception e) {
			 
			 return new ResponseEntity<User>(user, HttpStatus.BAD_REQUEST);
		 }
	 }

	 @PutMapping("/user/played")
	 public ResponseEntity<User> played(@RequestBody Map<String,String> body) {
		 
		 String id = body.get("id");
		 int userId = Integer.parseInt(id); 
		 User user = null;
		 
		 try {
	
			 user = userRepository.findById(userId);
			 user.setlasthand(new Date());
			 userRepository.save(user);
			 
			 return new ResponseEntity<User>(user, HttpStatus.OK);
			 
		 } catch (Exception e) {
			 
			 return new ResponseEntity<User>(user, HttpStatus.BAD_REQUEST);
		 }
	  }
}
