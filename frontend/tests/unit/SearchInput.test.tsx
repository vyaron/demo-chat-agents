import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SearchInput } from "../../src/components/SearchInput";

describe("SearchInput", () => {
  it("renders search input field", () => {
    const handleSearch = vi.fn();
    render(<SearchInput onSearch={handleSearch} />);
    const input = screen.getByPlaceholderText("Search messages");
    expect(input).toBeTruthy();
  });

  it("calls onSearch with debounce after user types", async () => {
    const handleSearch = vi.fn();
    render(<SearchInput onSearch={handleSearch} />);
    const input = screen.getByPlaceholderText("Search messages");

    await userEvent.type(input, "hello");

    // Debounce delay (300ms)
    await waitFor(() => {
      expect(handleSearch).toHaveBeenCalledWith("hello");
    });
  });

  it("does not call onSearch immediately on typing", async () => {
    const handleSearch = vi.fn();
    render(<SearchInput onSearch={handleSearch} />);
    const input = screen.getByPlaceholderText("Search messages");

    await userEvent.type(input, "h");

    // Should not be called immediately
    expect(handleSearch).not.toHaveBeenCalled();
  });

  it("shows result count when searching", async () => {
    const handleSearch = vi.fn();
    const { rerender } = render(
      <SearchInput onSearch={handleSearch} resultCount={0} />
    );

    const input = screen.getByPlaceholderText("Search messages");
    await userEvent.type(input, "test");

    rerender(<SearchInput onSearch={handleSearch} resultCount={3} />);

    await waitFor(() => {
      expect(screen.getByText("3 results")).toBeTruthy();
    });
  });

  it("shows singular 'result' for one match", async () => {
    const handleSearch = vi.fn();
    const { rerender } = render(
      <SearchInput onSearch={handleSearch} resultCount={0} />
    );

    const input = screen.getByPlaceholderText("Search messages");
    await userEvent.type(input, "test");

    rerender(<SearchInput onSearch={handleSearch} resultCount={1} />);

    await waitFor(() => {
      expect(screen.getByText("1 result")).toBeTruthy();
    });
  });

  it("clears search when clear button is clicked", async () => {
    const handleSearch = vi.fn();
    const { rerender } = render(
      <SearchInput onSearch={handleSearch} resultCount={2} />
    );

    const input = screen.getByPlaceholderText("Search messages") as HTMLInputElement;
    await userEvent.type(input, "test");

    expect(input.value).toBe("test");

    rerender(<SearchInput onSearch={handleSearch} resultCount={2} />);

    const clearBtn = screen.getByTestId("clear-search-btn");
    await userEvent.click(clearBtn);

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("shows loading spinner when isLoading is true", async () => {
    const handleSearch = vi.fn();
    const { rerender } = render(
      <SearchInput onSearch={handleSearch} isLoading={false} resultCount={0} />
    );

    const input = screen.getByTestId("search-input") as HTMLInputElement;
    await userEvent.type(input, "test");

    rerender(
      <SearchInput onSearch={handleSearch} isLoading={true} resultCount={0} />
    );

    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).toBeTruthy();
    });
  });
});
