# Airtable Import - Frontend Design System

## Overview
This document defines the design system and development guidelines for the Airtable Import application. All developers must follow these standards to ensure consistency and maintainability.

## Design Principles

### 1. **Modern Admin Dashboard Aesthetic**
- Clean, professional interface suitable for enterprise use
- Consistent spacing, typography, and color usage
- Card-based layouts with subtle shadows and borders
- Sidebar navigation with main content area

### 2. **Component Hierarchy**
```
App
├── Layout (Sidebar + Main Content)
│   ├── Sidebar (Navigation)
│   └── MainContent
│       ├── PageHeader (Title + Breadcrumb)
│       ├── PageContent (Cards/Sections)
│       └── PageFooter (Optional)
```

### 3. **Color Palette**
```css
Primary Colors:
- Primary Blue: #2563eb (buttons, links, active states)
- Primary Dark: #1e40af (hover states)
- Primary Light: #dbeafe (backgrounds, subtle highlights)

Semantic Colors:
- Success: #059669 (green)
- Warning: #d97706 (orange) 
- Error: #dc2626 (red)
- Info: #0891b2 (cyan)

Neutral Colors:
- Gray 50: #f9fafb (page background)
- Gray 100: #f3f4f6 (card background)
- Gray 200: #e5e7eb (borders)
- Gray 400: #9ca3af (disabled text)
- Gray 600: #4b5563 (secondary text)
- Gray 900: #111827 (primary text)
```

### 4. **Typography Scale**
```css
Font Family: 'Inter', system-ui, sans-serif

Sizes:
- Heading 1: 24px, weight 600, line-height 1.2
- Heading 2: 20px, weight 600, line-height 1.3
- Heading 3: 18px, weight 500, line-height 1.4
- Body Large: 16px, weight 400, line-height 1.5
- Body: 14px, weight 400, line-height 1.5
- Small: 12px, weight 400, line-height 1.4
```

### 5. **Spacing System (8px Grid)**
```css
- xs: 4px
- sm: 8px  
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
- 3xl: 64px
```

### 6. **Component Standards**

#### Cards
- Background: White (#ffffff)
- Border: 1px solid Gray 200
- Border radius: 8px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Padding: 24px

#### Buttons
```css
Primary Button:
- Background: Primary Blue
- Text: White
- Padding: 12px 24px
- Border radius: 6px
- Font weight: 500

Secondary Button:
- Background: White
- Text: Gray 600
- Border: 1px solid Gray 200
- Same padding/radius as primary

Danger Button:
- Background: Error Red
- Text: White
- Same styling as primary
```

#### Form Elements
```css
Input Fields:
- Border: 1px solid Gray 200
- Border radius: 6px
- Padding: 12px
- Focus: Border Primary Blue, box-shadow

Select/Dropdown:
- Same as input fields
- Chevron icon on right

Labels:
- Font weight: 500
- Color: Gray 900
- Margin bottom: 6px
```

## Page Templates

### 1. **Standard Page Template**
Every page should follow this structure:

```tsx
interface PageProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const StandardPage: React.FC<PageProps> = ({ title, subtitle, actions, children }) => (
  <div style={theme.page.container}>
    <PageHeader title={title} subtitle={subtitle} actions={actions} />
    <PageContent>
      {children}
    </PageContent>
  </div>
);
```

### 2. **Settings Page Template**
For configuration pages with form sections:

```tsx
const SettingsPage: React.FC = () => (
  <StandardPage 
    title="Settings" 
    subtitle="Configure your application settings"
  >
    <SettingsSection 
      title="Connection Settings"
      description="Configure external service connections"
    >
      <SettingsField label="API Key" type="password" />
      <SettingsField label="Base ID" type="text" />
    </SettingsSection>
  </StandardPage>
);
```

### 3. **Data Table Page Template**
For pages displaying tabular data:

```tsx
const TablePage: React.FC = () => (
  <StandardPage 
    title="Import Sessions" 
    subtitle="View and manage your import history"
    actions={<Button>New Import</Button>}
  >
    <DataCard>
      <DataTable columns={columns} data={data} />
    </DataCard>
  </StandardPage>
);
```

### 4. **Process/Wizard Page Template**
For multi-step processes:

```tsx
const ProcessPage: React.FC = () => (
  <StandardPage title="Import Data">
    <ProcessCard>
      <StepIndicator currentStep={2} totalSteps={4} />
      <StepContent>
        {/* Step-specific content */}
      </StepContent>
      <StepActions>
        <Button variant="secondary">Back</Button>
        <Button variant="primary">Next</Button>
      </StepActions>
    </ProcessCard>
  </StandardPage>
);
```

## Component Library Structure

### Core Components
```
src/components/
├── layout/
│   ├── Layout.tsx          # Main layout with sidebar
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── PageHeader.tsx      # Page title/breadcrumb
│   └── PageContent.tsx     # Main content wrapper
├── ui/
│   ├── Button.tsx          # Reusable button component
│   ├── Card.tsx           # Card container component
│   ├── Input.tsx          # Form input component
│   ├── Select.tsx         # Select dropdown component
│   ├── Table.tsx          # Data table component
│   └── Badge.tsx          # Status badge component
├── forms/
│   ├── SettingsField.tsx   # Settings form field
│   ├── SettingsSection.tsx # Settings section wrapper
│   └── FormGroup.tsx       # Form field group
└── features/
    ├── settings/           # Settings-specific components
    ├── import/            # Import-specific components
    └── dashboard/         # Dashboard-specific components
```

## File Naming Conventions

### React Components
- PascalCase for component files: `SettingsPage.tsx`
- camelCase for hooks: `useSettings.ts`
- kebab-case for utility files: `api-client.ts`

### Styling
- Use TypeScript objects for styles
- Prefix with `styles`: `const styles = { ... }`
- Group related styles in theme object

## Development Rules

### 1. **Component Rules**
- Every component must use TypeScript interfaces for props
- Include JSDoc comments for public components
- Use the design system theme object for all styling
- No hardcoded colors, spacing, or typography

### 2. **Page Rules**
- All pages must use StandardPage or appropriate template
- Include proper page titles and subtitles
- Add loading states for async operations
- Include error handling and user feedback

### 3. **Form Rules**
- Use controlled components with proper validation
- Show loading states during submission
- Display success/error messages clearly
- Support keyboard navigation

### 4. **Data Display Rules**
- Use consistent table styling and pagination
- Include search/filter capabilities where appropriate
- Show empty states with helpful messages
- Support sorting where relevant

## Theme Object Structure

```typescript
export const theme = {
  colors: {
    primary: { /* blue scale */ },
    semantic: { /* success, warning, error, info */ },
    neutral: { /* gray scale */ }
  },
  typography: {
    h1: { /* heading 1 styles */ },
    h2: { /* heading 2 styles */ },
    body: { /* body text styles */ }
  },
  spacing: {
    xs: '4px', sm: '8px', md: '16px', /* etc */ 
  },
  components: {
    button: { /* button variants */ },
    card: { /* card styles */ },
    input: { /* input styles */ }
  },
  layout: {
    sidebar: { /* sidebar dimensions */ },
    page: { /* page layout styles */ }
  }
};
```

## Quality Standards

### Accessibility
- All interactive elements must be keyboard accessible
- Use semantic HTML elements
- Include proper ARIA labels
- Maintain color contrast ratios (4.5:1 minimum)

### Performance  
- Lazy load components where appropriate
- Optimize images and assets
- Use React.memo for expensive renders
- Implement proper loading states

### Testing
- Write unit tests for utility functions
- Test user interactions in components
- Include accessibility tests
- Test responsive behavior

## Getting Started

1. **Review this design system** before starting any frontend work
2. **Use the theme object** for all styling - never hardcode values
3. **Follow the page templates** for consistency
4. **Reuse existing components** before creating new ones
5. **Test responsiveness** on mobile and desktop
6. **Ask for design review** before major UI changes

## Examples

See `/src/examples/` for reference implementations of:
- Standard settings page
- Data table with actions
- Multi-step process flow
- Form validation patterns
- Loading and error states

---

*This design system should be updated as the application evolves. All changes must be reviewed and documented.*