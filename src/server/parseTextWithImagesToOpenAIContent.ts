import * as fs from 'fs';
import * as path from 'path';
import { OpenAIContentBlock } from '../shared/CommonTypes';


/**
 * Parses a string with [img:filename] tags and returns an array of OpenAI content objects
 * ({type: 'text', text: ...} and {type: 'image_url', image_url: ...}) in the correct order.
 *
 * @param input The input string (may contain [img:filename] tags), yaml is recommended
 * @param imageDir The directory to resolve image filenames
 * @returns Array of OpenAI content objects
 */
export function parseTextWithImagesToOpenAIContent(input: string, imageDir: string): OpenAIContentBlock[] {
	let result: OpenAIContentBlock[] = [];
  if (!input || typeof input !== 'string') return result;

  // Regex to match [img:filename.ext]
  const regex = /\[img:([^\]]+)\]/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(input)) !== null) {
    const [tag, filename] = match;
    // Add preceding text if any
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index);
      if (text.trim()) result.push({ type: 'text', text });
    }
    // Add image_url object if file exists
    const imgPath = path.join(imageDir, filename);
		if (fs.existsSync(imgPath)) {
			const imgUrl = makeUrl(imgPath, filename);
			result.push(imgUrl as OpenAIContentBlock);
		} else {
      // If image not found, throw an error
      throw new Error(`Image file not found for tag ${tag} at path ${imgPath}`);
    }
    lastIndex = regex.lastIndex;
  }
  // Add any remaining text
  if (lastIndex < input.length) {
    const text = input.slice(lastIndex);
    if (text.trim()) result.push({ type: 'text', text });
  }
  return result;
}

function makeUrl(imgPath: string, filename: string) {
  const data = fs.readFileSync(imgPath);
  const base64 = data.toString('base64');
  const ext = path.extname(filename).toLowerCase();
  let mimeType = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.gif') mimeType = 'image/gif';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.bmp') mimeType = 'image/bmp';
  else if (ext === '.svg') mimeType = 'image/svg+xml';
  const imgUrl = { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } };
  return imgUrl;
}



  const imageDir = path.resolve(__dirname, '../../public/img'); // Adjust as needed

