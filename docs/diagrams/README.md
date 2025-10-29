# Quiver Architecture Diagrams

This directory contains visual architectural diagrams for the Quiver surf tracking platform. All diagrams are created using Mermaid syntax and are version-controlled alongside the code.

## 📊 Diagram Index

### Critical Foundation Diagrams

1. **[System Context](./system-context.md)** - High-level view of Quiver in its ecosystem
2. **[Container Architecture](./container-architecture.md)** - Major technology containers and their interactions
3. **[Database Schema (ERD)](./database-schema.md)** - Complete database entity-relationship diagram
4. **[Authentication Flow](./auth-flow.md)** - User authentication and authorization flows
5. **[Session Creation Flow](./session-creation-flow.md)** - End-to-end session creation process
6. **[Deployment Architecture](./deployment.md)** - Production infrastructure and deployment
7. **[API Request Lifecycle](./api-request-flow.md)** - API request processing flow

### High-Priority Diagrams

8. **[Component Hierarchy](./component-hierarchy.md)** - UI component relationships
9. **[Real-time Subscription Architecture](./realtime-architecture.md)** - WebSocket-based real-time updates
10. **[Forecast Data Aggregation](./forecast-aggregation.md)** - Multi-source forecast generation
11. **[Mobile Architecture](./mobile-architecture.md)** - Capacitor integration and native features
12. **[Caching Strategy](./caching-strategy.md)** - Multi-layer caching architecture

### Medium-Priority Diagrams

13. **[CI/CD Pipeline](./cicd-pipeline.md)** - Deployment workflow and automation
14. **[State Management](./state-management.md)** - Client-side state architecture
15. **[Error Handling Flow](./error-handling.md)** - Error propagation and user messaging

## 🛠️ Viewing Diagrams

All diagrams use [Mermaid](https://mermaid.js.org/) syntax and can be viewed in:

- **GitHub**: Automatically renders Mermaid diagrams in Markdown files
- **VS Code**: Install the "Markdown Preview Mermaid Support" extension
- **IDE/Editor**: Most modern editors support Mermaid rendering
- **Online**: Copy diagram code to [Mermaid Live Editor](https://mermaid.live/)

## 📝 Diagram Conventions

### Naming
- Use kebab-case for filenames (e.g., `system-context.md`)
- Start with a clear, descriptive title
- Include creation/update dates

### Structure
Each diagram file includes:
1. **Title** - Clear diagram name
2. **Purpose** - What the diagram shows
3. **Audience** - Who should use this diagram
4. **Diagram** - Mermaid code block
5. **Key Components** - Legend/explanation
6. **Related Diagrams** - Links to related documentation

### Mermaid Best Practices
- Use consistent colors and styles
- Keep diagrams focused and readable
- Add clear labels and descriptions
- Use sub-graphs for logical grouping
- Include legends when necessary

## 🔄 Updating Diagrams

When updating diagrams:
1. Update the Mermaid code
2. Add update date to the file
3. Document what changed and why
4. Update related documentation if needed
5. Review with team before merging

## 📚 Related Documentation

- [System Architecture Guide](../architecture/SYSTEM_ARCHITECTURE.md)
- [API Documentation](../architecture/API_DOCUMENTATION.md)
- [Security Guide](../architecture/SECURITY_GUIDE.md)
- [Database Schema Documentation](../architecture/DATABASE_SCHEMA.md)

---

**Last Updated**: October 28, 2025
**Maintained By**: Quiver Engineering Team
