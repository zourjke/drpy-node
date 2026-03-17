package com.fongmi.android.tv.server;

import fi.iki.elonen.NanoHTTPD.IHTTPSession;
import fi.iki.elonen.NanoHTTPD.Response;

import java.util.*;

public class Route {

    public interface Handler {
        Response handle(IHTTPSession session, Map<String, String> params);
    }

    private static class Node {
        Map<String, Node> children = new HashMap<>();
        Handler handler;
        boolean isParam;
        boolean isWildcard;
        String paramName;
    }

    private final Node root;

    public Route() {
        root = new Node();
    }

    // ====================== Fastify 方法 ======================
    public Route get(String path, Handler handler) {
        addRoute(path, handler);
        return this;
    }

    public Route post(String path, Handler handler) {
        addRoute(path, handler);
        return this;
    }

    public Route put(String path, Handler handler) {
        addRoute(path, handler);
        return this;
    }

    public Route delete(String path, Handler handler) {
        addRoute(path, handler);
        return this;
    }

    public Route head(String path, Handler handler) {
        addRoute(path, handler);
        return this;
    }

    public Route options(String path, Handler handler) {
        addRoute(path, handler);
        return this;
    }

    public Route all(String path, Handler handler) {
        get(path, handler);
        post(path, handler);
        put(path, handler);
        delete(path, handler);
        head(path, handler);
        options(path, handler);
        return this;
    }

    // ====================== 核心路由注册 ======================
    private void addRoute(String path, Handler handler) {
        if (path == null || path.isEmpty()) path = "/";
        if (!path.startsWith("/")) path = "/" + path;

        Node node = root;
        String[] parts = path.split("/");

        for (String part : parts) {
            if (part.isEmpty()) continue;

            if (part.equals("*")) {
                node.children.putIfAbsent("*", new Node());
                Node wild = node.children.get("*");
                wild.isWildcard = true;
                wild.paramName = "*";
                node = wild;
                break;
            } else if (part.startsWith(":") && part.endsWith("*") && part.length() > 2) {
                String name = part.substring(1, part.length() - 1);
                node.children.putIfAbsent(":*", new Node());
                Node pw = node.children.get(":*");
                pw.isParam = true;
                pw.isWildcard = true;
                pw.paramName = name;
                node = pw;
                break;
            } else if (part.startsWith(":")) {
                node.children.putIfAbsent(":", new Node());
                Node param = node.children.get(":");
                param.isParam = true;
                param.paramName = part.substring(1);
                node = param;
            } else {
                node.children.putIfAbsent(part, new Node());
                node = node.children.get(part);
            }
        }
        node.handler = handler;
    }

    // ====================== 路由匹配 ======================
    private Match match(String path) {
        Node node = root;
        Map<String, String> params = new HashMap<>();
        String[] parts = path.split("/");
        int i = 0;

        while (i < parts.length) {
            if (node.isWildcard) break;

            String part = parts[i];
            if (part.isEmpty()) {
                i++;
                continue;
            }

            if (node.children.containsKey(part)) {
                node = node.children.get(part);
            } else if (node.children.containsKey(":")) {
                node = node.children.get(":");
                params.put(node.paramName, part);
            } else if (node.children.containsKey(":*")) {
                node = node.children.get(":*");
                params.put(node.paramName, joinRest(parts, i));
                break;
            } else if (node.children.containsKey("*")) {
                node = node.children.get("*");
                params.put("*", joinRest(parts, i));
                break;
            } else {
                return null;
            }
            i++;
        }

        if (node.handler == null) return null;
        Match m = new Match();
        m.handler = node.handler;
        m.params = params;
        return m;
    }

    private static class Match {
        Handler handler;
        Map<String, String> params;
    }

    private String joinRest(String[] parts, int index) {
        StringBuilder sb = new StringBuilder();
        for (int j = index; j < parts.length; j++) {
            if (!parts[j].isEmpty()) {
                if (sb.length() > 0) sb.append("/");
                sb.append(parts[j]);
            }
        }
        return sb.toString();
    }

    // ====================== 原有接口不动 ======================
    public Response handle(IHTTPSession session) {
        String path = session.getUri().trim();
        if (path.contains("?")) path = path.substring(0, path.indexOf("?"));
        Match match = match(path);
        return match == null ? null : match.handler.handle(session, match.params);
    }

    public boolean hasRoute(String method, String path) {
        if (path.contains("?")) path = path.substring(0, path.indexOf("?"));
        return match(path) != null;
    }
}
