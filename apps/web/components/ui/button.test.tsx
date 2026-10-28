// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("renders the inverse variant as a pill with inverse colors", () => {
    render(<Button variant="inverse">Generar reporte</Button>);
    const className = screen.getByRole("button").className;
    expect(className).toContain("bg-inverse");
    expect(className).toContain("text-inverse-foreground");
    expect(className).toContain("rounded-full");
  });

  it("keeps touch targets at 40px or more", () => {
    render(
      <>
        <Button>Default</Button>
        <Button size="icon" aria-label="icon" />
      </>,
    );
    expect(screen.getByText("Default").className).toContain("h-10");
    expect(screen.getByLabelText("icon").className).toContain("size-10");
  });

  it("offers a 44px round control size for the camera control bar", () => {
    render(<Button size="control" variant="secondary" aria-label="Capturar" />);
    const className = screen.getByLabelText("Capturar").className;
    expect(className).toContain("size-11");
    expect(className).toContain("rounded-full");
  });
});
