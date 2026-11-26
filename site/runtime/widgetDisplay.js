import { createContext, useContext } from 'react';
import { widgetSpacingStyle } from '../../shared/widgetDisplay.js';

export const WidgetDisplayContext = createContext({});

export function useWidgetSpacing() {
    return widgetSpacingStyle(useContext(WidgetDisplayContext));
}
