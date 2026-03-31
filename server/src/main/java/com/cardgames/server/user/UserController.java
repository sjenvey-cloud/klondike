package com.cardgames.server.user;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.Map;

@CrossOrigin(origins = {
    "http://localhost:3000",
    "http://localhost:4200",
    "http://localhost:5173",
    "https://dbk2b6k1kyjsy.cloudfront.net"
})
@RestController
@RequestMapping("/api/v1")
public class UserController {

    @Autowired
    UserRepository userRepository;

    @GetMapping("/users/{id}")
    public ResponseEntity<User> show(@PathVariable int id) {
        User user = userRepository.findById(id);
        if (user == null) return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        return new ResponseEntity<>(user, HttpStatus.OK);
    }

    @GetMapping("/users/username/{username}")
    public ResponseEntity<User> showByUsername(@PathVariable String username) {
        User user = userRepository.findByUsername(username);
        if (user == null) return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        return new ResponseEntity<>(user, HttpStatus.OK);
    }

    @PostMapping("/users")
    public ResponseEntity<User> create(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        User user = new User(username, new Date(), User.getDefaultTime());
        try {
            userRepository.save(user);
            return new ResponseEntity<>(user, HttpStatus.CREATED);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PutMapping("/users/played")
    public ResponseEntity<User> played(@RequestBody Map<String, String> body) {
        int userId = Integer.parseInt(body.get("id"));
        User user = userRepository.findById(userId);
        if (user == null) return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        user.setlasthand(new Date());
        userRepository.save(user);
        return new ResponseEntity<>(user, HttpStatus.OK);
    }
}
