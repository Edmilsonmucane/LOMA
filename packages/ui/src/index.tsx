'use client';
import {
  useEffect,
  useId,
  useSyncExternalStore,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import * as Dialog from '@radix-ui/react-dialog';
import * as RadixTabs from '@radix-ui/react-tabs';
import {
  CircleNotchIcon,
  XIcon,
  WarningCircleIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react';

const subscribeHydration = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
}

export function Button({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}) {
  const hydrated = useHydrated();
  return (
    <button
      type="button"
      {...props}
      disabled={!hydrated || disabled || loading}
      aria-busy={loading || undefined}
      className={`ui-button ui-button-${variant} ${className}`}
    >
      {loading && <CircleNotchIcon aria-hidden className="ui-spinner" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  help,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  help?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}) {
  const hydrated = useHydrated();
  const generated = useId();
  const fieldId = id ?? generated;
  const descriptionId = `${fieldId}-description`;
  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={fieldId}>
        {label}
      </label>
      <input
        {...props}
        disabled={!hydrated || props.disabled}
        id={fieldId}
        className="ui-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error || help ? descriptionId : undefined}
      />
      {(error || help) && (
        <p id={descriptionId} className={error ? 'ui-error' : 'ui-help'}>
          {error ?? help}
        </p>
      )}
    </div>
  );
}
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}
export type TableColumn<T> = {
  key: string;
  heading: string;
  align?: 'right';
  render: (row: T) => ReactNode;
};
export function Table<T extends { id: string }>({
  columns,
  rows,
  compact = false,
  label,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  compact?: boolean;
  label: string;
}) {
  'use no memo'; // TanStack exposes mutable callbacks; keep this component outside compiler memoization.
  // This component explicitly opts out of compiler memoization; TanStack manages its own state.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: columns.map<ColumnDef<T>>((column) => ({
      id: column.key,
      header: column.heading,
      cell: (context) => column.render(context.row.original),
    })),
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div className="ui-table-scroll">
      <table
        aria-label={label}
        className={`ui-table ${compact ? 'ui-table-compact' : ''}`}
      >
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  data-align={
                    columns.find((column) => column.key === header.column.id)
                      ?.align
                  }
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  data-align={
                    columns.find((column) => column.key === cell.column.id)
                      ?.align
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Tabs({
  label,
  items,
}: {
  label: string;
  items: {
    value: string;
    label: string;
    content: ReactNode;
    disabled?: boolean;
  }[];
}) {
  return (
    <RadixTabs.Root defaultValue={items[0]?.value ?? ''}>
      <RadixTabs.List className="ui-tabs-list" aria-label={label}>
        {items.map((item) => (
          <RadixTabs.Trigger
            className="ui-tabs-trigger"
            key={item.value}
            value={item.value}
            disabled={item.disabled}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content
          key={item.value}
          value={item.value}
          className="ui-tabs-content"
        >
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
export function Drawer({
  trigger,
  title,
  description,
  closeLabel,
  children,
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  closeLabel: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog.Root
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay" />
        <Dialog.Content className="ui-drawer">
          <div className="ui-dialog-header">
            <Dialog.Title className="ui-dialog-title">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label={closeLabel}>
                <XIcon aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="ui-dialog-description">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export type CommandItem = {
  id: string;
  label: string;
  keywords?: string;
  icon?: ReactNode;
  onSelect: () => void;
};
export function CommandPalette({
  trigger,
  title,
  description,
  searchLabel,
  emptyLabel,
  closeLabel,
  items,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  searchLabel: string;
  emptyLabel: string;
  closeLabel: string;
  items: CommandItem[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const filtered = items.filter((item) =>
    `${item.label} ${item.keywords ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes(
        query
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase(),
      ),
  );
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const select = (item: CommandItem) => {
    setOpen(false);
    item.onSelect();
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setQuery('');
        setActive(0);
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay" />
        <Dialog.Content
          className="ui-command"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="ui-dialog-header">
            <Dialog.Title className="ui-dialog-title">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label={closeLabel}>
                <XIcon aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {description}
          </Dialog.Description>
          <Field
            ref={inputRef}
            label={searchLabel}
            placeholder={searchLabel}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              filtered[active] ? `${listId}-${filtered[active]?.id}` : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, filtered.length - 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              }
              if (event.key === 'Enter' && filtered[active]) {
                event.preventDefault();
                select(filtered[active]);
              }
            }}
          />
          <div
            className="ui-command-results"
            role="listbox"
            aria-label={title}
            id={listId}
          >
            {filtered.map((item, index) => (
              <button
                type="button"
                role="option"
                id={`${listId}-${item.id}`}
                key={item.id}
                aria-selected={index === active}
                tabIndex={-1}
                className="ui-command-item"
                onClick={() => select(item)}
              >
                {item.icon ?? <MagnifyingGlassIcon aria-hidden />}
                {item.label}
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="ui-help" role="status">
              {emptyLabel}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Skeleton({
  className = '',
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`ui-skeleton ${className}`}
      {...(label
        ? { role: 'status', 'aria-label': label }
        : { 'aria-hidden': true })}
    />
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Notice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-notice" role="status">
      <WarningCircleIcon aria-hidden />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        {action}
      </div>
    </div>
  );
}
