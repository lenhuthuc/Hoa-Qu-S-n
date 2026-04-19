package com.trash.ecommerce.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Autowired
    private JwtFilter jwtFilter;
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        return http
                .cors(cors -> cors.configurationSource(configurationSource()))
                .csrf(customize -> customize.disable())
                .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/health").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/user/auth/login", "/api/user/auth/register", "/api/user/auth/logout").permitAll()
                        .requestMatchers("/api/user/auth/reset-password", "/api/user/auth/verify-otp", "/api/user/auth/change-password").permitAll()
                        .requestMatchers("/api/products/**").permitAll()
                        .requestMatchers("/api/categories/**").permitAll()
                        .requestMatchers("GET", "/api/reviews/products/**").permitAll()
                        .requestMatchers("GET", "/api/reviews/media/**").permitAll()
                        .requestMatchers("/api/reviews/**").authenticated()
                        .requestMatchers("/api/admin/**").hasAuthority("ADMIN")
                        .requestMatchers("/api/user/**").hasAnyAuthority("USER", "ADMIN")
                        .requestMatchers("/api/payments/vnpay/**").permitAll()
                        .requestMatchers("GET", "/api/traceability/**").permitAll()
                        .requestMatchers("GET", "/api/market-prices/**").permitAll()
                        .requestMatchers("/api/farming-journal/**").authenticated()
                        .requestMatchers("/api/traceability/**").authenticated()
                        .requestMatchers("/api/shipping/**").permitAll()
                        .requestMatchers("GET", "/api/trust-score/**").permitAll()
                        .requestMatchers("/api/trust-score/**").authenticated()
                        .requestMatchers("/api/returns/**").authenticated()
                        .requestMatchers("/api/seller/**").hasAnyAuthority("SELLER", "ADMIN")
                        .requestMatchers("/api/notifications/**").authenticated()
                        .requestMatchers("GET", "/api/vouchers/available").permitAll()
                        .requestMatchers("POST", "/api/vouchers/validate").permitAll()
                        .requestMatchers("/api/vouchers/**").authenticated()
                        .requestMatchers("/api/wishlist/**").authenticated()
                        .requestMatchers("GET", "/api/shop/**").permitAll()
                        .requestMatchers("/api/messages/**").authenticated()
                        .requestMatchers("/api/coins/**").authenticated()
                        .requestMatchers("GET", "/api/stories").permitAll()
                        .requestMatchers("GET", "/api/stories/seller/**").permitAll()
                        .requestMatchers("/api/stories/**").authenticated()
                        .requestMatchers("/api/admin/analytics/**").hasAuthority("ADMIN")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(exception -> exception
                    .authenticationEntryPoint((request, response, authException) -> {
                        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized");
                    })
                    .accessDeniedHandler((request, response, accessDeniedException) -> {
                        response.sendError(HttpServletResponse.SC_FORBIDDEN, "Access Denied");
                    })
                )
                .formLogin(login -> login.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider(UserDetailsService userDetailsService) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(new BCryptPasswordEncoder(12));
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); 
    }

    @Bean
    public CorsConfigurationSource configurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "https://haquason.uk",
            "https://www.haquason.uk",
            "https://api.haquason.uk"
        ));
        config.setAllowedMethods(List.of("*"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
