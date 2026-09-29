import {
  Button,
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tooltip,
} from "@fluentui/react-components";
import { DarkThemeRegular, WeatherMoonRegular, WeatherSunnyRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useThemeMode, type ThemeMode } from "../lib/theme";

const ICONS = {
  system: <DarkThemeRegular />,
  light: <WeatherSunnyRegular />,
  dark: <WeatherMoonRegular />,
};

export function ThemeToggle() {
  const { t } = useTranslation();
  const { mode, setMode } = useThemeMode();
  return (
    <Menu
      checkedValues={{ theme: [mode] }}
      onCheckedValueChange={(_, d) => setMode(d.checkedItems[0] as ThemeMode)}
    >
      <Tooltip content={t("theme.label")} relationship="label">
        <MenuTrigger disableButtonEnhancement>
          <Button appearance="subtle" icon={ICONS[mode]} />
        </MenuTrigger>
      </Tooltip>
      <MenuPopover>
        <MenuList>
          <MenuItemRadio name="theme" value="system" icon={ICONS.system}>
            {t("theme.system")}
          </MenuItemRadio>
          <MenuItemRadio name="theme" value="light" icon={ICONS.light}>
            {t("theme.light")}
          </MenuItemRadio>
          <MenuItemRadio name="theme" value="dark" icon={ICONS.dark}>
            {t("theme.dark")}
          </MenuItemRadio>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
