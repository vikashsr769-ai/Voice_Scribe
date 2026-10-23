package com.voicescribe.backend.service;

import com.voicescribe.backend.controller.TokenResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ElevenLabsService {

    private final RestClient restClient;
    private final String apiKey;

    public ElevenLabsService(
            @Value("${elevenlabs.api-key:}") String apiKey) {

        this.apiKey = apiKey;
        this.restClient = RestClient.builder()
                .baseUrl("https://api.elevenlabs.io")
                .build();
    }

    public TokenResponse createRealtimeToken() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "ElevenLabs API key is not configured"
            );
        }

        try {
            TokenResponse response = restClient.post()
                    .uri("/v1/single-use-token/realtime_scribe")
                    .header("xi-api-key", apiKey)
                    .retrieve()
                    .body(TokenResponse.class);

            if (response == null || response.token() == null
                    || response.token().isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "ElevenLabs returned an empty token"
                );
            }

            return response;

        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to obtain an ElevenLabs token. Check API access and service availability."
            );
        }
    }
}
