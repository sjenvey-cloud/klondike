package com.cardgames.server.config;

import com.amazonaws.xray.AWSXRay;
import com.amazonaws.xray.AWSXRayRecorderBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

/**
 * DEV-218: AWS X-Ray distributed tracing.
 *
 * Uses a native jakarta.servlet.Filter wrapper instead of AWSXRayServletFilter
 * (which depends on javax.servlet, incompatible with Spring Boot 3.x / Jakarta EE 9+).
 * Enabled via xray.enabled=true (injected as XRAY_ENABLED env var in ECS).
 * When disabled a no-op filter is registered so the bean always resolves cleanly.
 */
@Configuration
public class XRayConfig {

    private static final Logger log = LoggerFactory.getLogger(XRayConfig.class);

    @Value("${xray.enabled:false}")
    private boolean xrayEnabled;

    @PostConstruct
    public void configureRecorder() {
        if (!xrayEnabled) {
            log.info("X-Ray tracing disabled (xray.enabled=false)");
            return;
        }
        try {
            AWSXRay.setGlobalRecorder(
                AWSXRayRecorderBuilder.standard().build()
            );
            log.info("X-Ray recorder configured");
        } catch (Exception e) {
            log.warn("X-Ray recorder setup failed — tracing will be a no-op: {}", e.getMessage());
        }
    }

    @Bean
    public FilterRegistrationBean<Filter> xrayFilter() {
        FilterRegistrationBean<Filter> bean = new FilterRegistrationBean<>();
        bean.setFilter(xrayEnabled ? new XRayTracingFilter() : (req, res, chain) -> chain.doFilter(req, res));
        bean.addUrlPatterns("/api/*");
        bean.setOrder(1);
        return bean;
    }

    /**
     * Jakarta-compatible X-Ray tracing filter.
     * Opens a named segment for every inbound API request and closes it after
     * the response is committed (or an exception propagates).
     */
    static class XRayTracingFilter implements Filter {

        @Override
        public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                throws IOException, ServletException {
            String segmentName = "klondike-api";
            if (request instanceof HttpServletRequest http) {
                segmentName = http.getMethod() + " " + http.getRequestURI();
            }
            try {
                AWSXRay.beginSegment(segmentName);
                chain.doFilter(request, response);
            } catch (Exception e) {
                AWSXRay.getCurrentSegmentOptional()
                       .ifPresent(seg -> seg.addException(e));
                throw e;
            } finally {
                try { AWSXRay.endSegment(); } catch (Exception ignored) {}
            }
        }
    }
}
