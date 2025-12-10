import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FormInput,
  FormTextarea,
  FormSelect,
} from "@/components/ui/form-fields";

// Test wrapper that provides form context
function FormWrapper({
  children,
  defaultValues = {},
}: {
  children: React.ReactNode;
  defaultValues?: Record<string, unknown>;
}) {
  const schema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    tag: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      tag: "",
      ...defaultValues,
    },
  });

  return <FormProvider {...form}>{children}</FormProvider>;
}

// Component that renders FormInput inside form context
function TestFormInput(
  props: Omit<
    React.ComponentProps<typeof FormInput<{ title?: string }>>,
    "control"
  >
) {
  const schema = z.object({
    title: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { title: "" },
  });

  return (
    <FormProvider {...form}>
      <FormInput control={form.control} {...(props as any)} />
    </FormProvider>
  );
}

// Component that renders FormTextarea inside form context
function TestFormTextarea(
  props: Omit<
    React.ComponentProps<typeof FormTextarea<{ description?: string }>>,
    "control"
  >
) {
  const schema = z.object({
    description: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { description: "" },
  });

  return (
    <FormProvider {...form}>
      <FormTextarea control={form.control} {...(props as any)} />
    </FormProvider>
  );
}

// Component that renders FormSelect inside form context
function TestFormSelect(
  props: Omit<
    React.ComponentProps<typeof FormSelect<{ tag?: string }>>,
    "control"
  >
) {
  const schema = z.object({
    tag: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { tag: "" },
  });

  return (
    <FormProvider {...form}>
      <FormSelect control={form.control} {...(props as any)} />
    </FormProvider>
  );
}

describe("FormInput", () => {
  it("renders with required props", () => {
    render(<TestFormInput name="title" label="Title" />);

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("renders with placeholder", () => {
    render(
      <TestFormInput name="title" label="Title" placeholder="Enter title" />
    );

    expect(screen.getByPlaceholderText("Enter title")).toBeInTheDocument();
  });

  it("shows character counter when maxLength is provided", async () => {
    const user = userEvent.setup();

    render(<TestFormInput name="title" label="Title" maxLength={100} />);

    // Initially shows 0/100
    expect(screen.getByText("0/100 characters")).toBeInTheDocument();

    // Type some text
    const input = screen.getByLabelText("Title");
    await user.type(input, "Hello");

    // Now shows 5/100
    expect(screen.getByText("5/100 characters")).toBeInTheDocument();
  });

  it("hides character counter when showCharCount is false", () => {
    render(
      <TestFormInput
        name="title"
        label="Title"
        maxLength={100}
        showCharCount={false}
      />
    );

    expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
  });

  it("shows description when maxLength is not provided", () => {
    render(
      <TestFormInput name="title" label="Title" description="Enter the title" />
    );

    expect(screen.getByText("Enter the title")).toBeInTheDocument();
  });

  it("prefers character counter over description when maxLength is set", () => {
    render(
      <TestFormInput
        name="title"
        label="Title"
        maxLength={100}
        description="This should not show"
      />
    );

    expect(screen.getByText("0/100 characters")).toBeInTheDocument();
    expect(screen.queryByText("This should not show")).not.toBeInTheDocument();
  });

  it("enforces maxLength on input element", () => {
    render(<TestFormInput name="title" label="Title" maxLength={10} />);

    const input = screen.getByLabelText("Title");
    expect(input).toHaveAttribute("maxLength", "10");
  });
});

describe("FormTextarea", () => {
  it("renders with required props", () => {
    render(<TestFormTextarea name="description" label="Description" />);

    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("shows character counter when maxLength is provided", async () => {
    const user = userEvent.setup();

    render(
      <TestFormTextarea
        name="description"
        label="Description"
        maxLength={500}
      />
    );

    // Initially shows 0/500
    expect(screen.getByText("0/500 characters")).toBeInTheDocument();

    // Type some text
    const textarea = screen.getByLabelText("Description");
    await user.type(textarea, "Test content");

    // Now shows 12/500
    expect(screen.getByText("12/500 characters")).toBeInTheDocument();
  });

  it("hides character counter when showCharCount is false", () => {
    render(
      <TestFormTextarea
        name="description"
        label="Description"
        maxLength={500}
        showCharCount={false}
      />
    );

    expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
  });

  it("shows description when maxLength is not provided", () => {
    render(
      <TestFormTextarea
        name="description"
        label="Description"
        description="Enter a detailed description"
      />
    );

    expect(
      screen.getByText("Enter a detailed description")
    ).toBeInTheDocument();
  });

  it("enforces maxLength on textarea element", () => {
    render(
      <TestFormTextarea
        name="description"
        label="Description"
        maxLength={500}
      />
    );

    const textarea = screen.getByLabelText("Description");
    expect(textarea).toHaveAttribute("maxLength", "500");
  });

  it("renders with custom rows", () => {
    render(
      <TestFormTextarea name="description" label="Description" rows={6} />
    );

    const textarea = screen.getByLabelText("Description");
    expect(textarea).toHaveAttribute("rows", "6");
  });
});

describe("FormSelect", () => {
  const testOptions = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
  ];

  it("renders with required props", () => {
    render(<TestFormSelect name="tag" label="Tag" options={testOptions} />);

    expect(screen.getByText("Tag")).toBeInTheDocument();
  });

  it("renders with placeholder", () => {
    render(
      <TestFormSelect
        name="tag"
        label="Tag"
        options={testOptions}
        placeholder="Select a tag"
      />
    );

    expect(screen.getByText("Select a tag")).toBeInTheDocument();
  });

  it("renders options with custom renderOption", async () => {
    const user = userEvent.setup();

    const richOptions = [
      { value: "parking", label: "Parking", description: "Parking info" },
      { value: "hazard", label: "Hazard", description: "Safety warnings" },
    ];

    render(
      <TestFormSelect
        name="tag"
        label="Tag"
        options={richOptions}
        renderOption={(option) => (
          <div data-testid={`option-${option.value}`}>
            <span className="font-medium">{option.label}</span>
            <span className="text-muted">{option.description as string}</span>
          </div>
        )}
      />
    );

    // Click to open the select
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    // Check that custom rendered options are present
    expect(screen.getByTestId("option-parking")).toBeInTheDocument();
    expect(screen.getByTestId("option-hazard")).toBeInTheDocument();
    expect(screen.getByText("Parking info")).toBeInTheDocument();
    expect(screen.getByText("Safety warnings")).toBeInTheDocument();
  });

  it("renders default option label when renderOption is not provided", async () => {
    const user = userEvent.setup();

    render(<TestFormSelect name="tag" label="Tag" options={testOptions} />);

    // Click to open the select
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    // Check that default labels are shown
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
  });

  it("renders with description", () => {
    render(
      <TestFormSelect
        name="tag"
        label="Tag"
        options={testOptions}
        description="Select the most appropriate tag"
      />
    );

    expect(
      screen.getByText("Select the most appropriate tag")
    ).toBeInTheDocument();
  });
});
