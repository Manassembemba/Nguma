
import { NotificationBell } from "./NotificationBell";

export const AppHeader = () => {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-end whitespace-nowrap border-b border-solid border-border bg-background/80 px-8 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <NotificationBell />
        {/* Other header items like user menu can go here */}
      </div>
    </header>
  );
};
