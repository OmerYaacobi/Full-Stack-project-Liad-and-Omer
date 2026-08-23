export function ShareWithManagersField({
  defaultChecked = false,
  disabled,
}: {
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="sm:col-span-2 flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        name="shareWithManagers"
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5"
      />
      <span>
        <span className="font-medium text-slate-900">Managers can open this</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          Every manager in this business, not only the person it is filed
          against. Unchecked, only that person and you can open it.
        </span>
      </span>
    </label>
  );
}
