export function ShareWithManagersField({
  defaultChecked = true,
  checked,
  onChange,
  disabled,
}: {
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const isControlled = checked !== undefined;
  return (
    <label className="sm:col-span-2 flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        name="shareWithManagers"
        defaultChecked={isControlled ? undefined : defaultChecked}
        checked={isControlled ? checked : undefined}
        onChange={
          onChange ? (event) => onChange(event.target.checked) : undefined
        }
        disabled={disabled}
        className="mt-0.5"
      />
      <span>
        <span className="font-medium text-slate-900">Managers can open this</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          On by default. Every manager in this business can open it, not only
          the person it is filed against. Uncheck to keep it between that
          person and you.
        </span>
      </span>
    </label>
  );
}
