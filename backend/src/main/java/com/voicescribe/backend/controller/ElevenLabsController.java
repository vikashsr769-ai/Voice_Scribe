package com.voicescribe.backend.controller;

import com.voicescribe.backend.service.ElevenLabsService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transcriptions")
public class ElevenLabsController {

    private final ElevenLabsService elevenLabsService;

    public ElevenLabsController(ElevenLabsService elevenLabsService) {
        this.elevenLabsService = elevenLabsService;
    }

    @PostMapping("/token")
    public TokenResponse createToken() {
        return elevenLabsService.createRealtimeToken();
    }
}
