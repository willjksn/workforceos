import { Container, Section } from "@/components/ui";

export default function NotFound() {
  return (
    <Section>
      <Container>
        <h1 className="font-serif text-4xl text-navy">Page not found</h1>
        <p className="mt-4 text-muted">The page you requested is not available.</p>
      </Container>
    </Section>
  );
}
