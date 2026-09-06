export function TimeOffAttachmentLink({
  attachmentId,
  title,
}: {
  attachmentId: string;
  title: string;
}) {
  return (
    <a
      href={`/api/time-off/attachments/${attachmentId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
    >
      {title}
    </a>
  );
}
