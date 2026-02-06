import type { FC } from "react";
import { ThreadPrimitive, useThread } from "@assistant-ui/react";
import { useThreadConfig } from "@assistant-ui/react-ui";
import { getAvatarIcon } from "@/components/avatarIcons";

const ThreadWelcome: FC = () => {
  return (
    <ThreadPrimitive.Empty>
      <div className="aui-thread-welcome-root">
        <div className="aui-thread-welcome-center">
          <WelcomeAvatar />
          <WelcomeMessage />
        </div>
        <WelcomeSuggestions />
      </div>
    </ThreadPrimitive.Empty>
  );
};

const WelcomeAvatar: FC = () => {
  const AvatarIcon = getAvatarIcon();
  return (
    <div className="aui-avatar-root">
      <div className="aui-avatar-fallback text-muted-foreground">
        <AvatarIcon className="h-4 w-4" />
      </div>
    </div>
  );
};

const WelcomeMessage: FC = () => {
  const {
    welcome: { message } = {},
    strings: { welcome: { message: defaultMessage = "How can I help you today?" } = {} } = {},
  } = useThreadConfig();

  return <p className="aui-thread-welcome-message">{message ?? defaultMessage}</p>;
};

const WelcomeSuggestions: FC = () => {
  const suggestionsFromThread = useThread((t) => t.suggestions);
  const { welcome: { suggestions } = {} } = useThreadConfig();
  const finalSuggestions = suggestionsFromThread.length ? suggestionsFromThread : suggestions;

  return (
    <div className="aui-thread-welcome-suggestions">
      {finalSuggestions?.map((suggestion, idx) => (
        <ThreadPrimitive.Suggestion
          key={`${suggestion.prompt}-${idx}`}
          className="aui-thread-welcome-suggestion"
          prompt={suggestion.prompt}
          method="replace"
          autoSend
        >
          <span className="aui-thread-welcome-suggestion-text">
            {suggestion.text ?? suggestion.prompt}
          </span>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
};

export { ThreadWelcome };
