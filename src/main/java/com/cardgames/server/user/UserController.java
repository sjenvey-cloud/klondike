package com.cardgames.server.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.Map;

@Tag(name = "User (Legacy)", description = "Legacy user lookup/create endpoints — prefer /api/v1/auth and /api/v1/profile")
@CrossOrigin(origins = {
    "http://localhost:4200",
    "http://localhost:5173",
    "https://dbk2b6k1kyjsy.cloudfront.net",
    "https://d2fbehwb6bp7kq.cloudfront.net",
    "https://klondikepro.app",
    "https://www.klondikepro.app"
})
@RestController
@RequestMapping("/api/v1")
public class UserController {

    @Autowired
    UserRepository userRepository;

    @GetMapping("/users/{id}")
    public ResponseEntity<User> show(@PathVariable int id) {
        return userRepository.findById(id)
            .map(u -> new ResponseEntity<>(u, HttpStatus.OK))
            .orElse(new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    @GetMapping("/users/username/{username}")
    public ResponseEntity<User> showByUsername(@PathVariable String username) {
        return userRepository.findByUsername(username)
            .map(u -> new ResponseEntity<>(u, HttpStatus.OK))
            .orElse(new ResponseEntity<>(HttpStatus.NOT_FOUND));
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
        return userRepository.findById(userId).map(user -> {
            user.setlasthand(new Date());
            userRepository.save(user);
            return new ResponseEntity<>(user, HttpStatus.OK);
        }).orElse(new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }
}
