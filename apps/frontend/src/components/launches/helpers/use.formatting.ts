import { useMemo } from 'react';
export const useFormatting = (
  text: Array<{
    content: string;
    image?: Array<{
      id: string;
      path: string;
    }>;
    id?: string;
  }>,
  params: {
    removeMarkdown?: boolean;
    saveBreaklines?: boolean;
    specialFunc?: (text: string) => any;
    beforeSpecialFunc?: (text: string) => string;
  }
) => {
  return useMemo(() => {
    return text.map((value) => {
      let newText = value.content;
      if (params.beforeSpecialFunc) {
        newText = params.beforeSpecialFunc(newText);
      }
      // Both halves of the swap are global. With a string argument `replace`
      // only touches the FIRST match, so a post with two or more newlines
      // parked the placeholder in the text permanently: the restore below hit
      // the first placeholder and the rest were left standing.
      if (params.saveBreaklines) {
        newText = newText.replace(/\n/g, '𝔫𝔢𝔴𝔩𝔦𝔫𝔢');
      }
      newText = newText.replace(/@\w{1,15}/g, function (match) {
        return `<strong>${match}</strong>`;
      });
      if (params.saveBreaklines) {
        newText = newText.replace(/𝔫𝔢𝔴𝔩𝔦𝔫𝔢/g, '\n');
      }
      if (params.specialFunc) {
        newText = params.specialFunc(newText);
      }
      return {
        id: value.id,
        text: newText,
        images: value.image,
        count:
          params.removeMarkdown && params.saveBreaklines
            ? newText.replace(/\n/g, ' ').length
            : newText.length,
      };
    });
  }, [text]);
};
