import { Either, isLeft, left, right } from 'fp-ts/lib/Either';
import * as dotenv from 'dotenv';
import { performSearch, endSession } from './accessEBSCOAPI';
import { SearchResponse, Record, DisplayRecord, Item, Holdings, CopyInformation } from './Record';
import {getEnvironmentVariables} from './ebscoService'
const he = require('he');

dotenv.config();

/**
 * Extracts specific item data from a given list of items.
 * 
 * @param items - A list of items from which data is to be extracted.
 * @param name - The name of the item data to extract.
 * 
 * @returns The extracted data if it exists, 'Not available' otherwise.
 */
function extractItemData(items: Item[] | undefined, name: string): string {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Not available';
  }
  const item = items.find((i: Item) => i.Name === name);
  return item?.Data || 'Not available';
}

/**
 * Extracts the publication year from a given list of items.
 * 
 * @param items - A list of items from which the publication year is to be extracted.
 * 
 * @returns The extracted publication year if it exists, NaN otherwise.
 */
function extractPublicationYear(items: Item[] | undefined): number {
  if (!Array.isArray(items) || items.length === 0) {
    return NaN;
  }

  const titleSource = extractItemData(items, 'TitleSource');
  const publicationYearMatch = titleSource.match(/(\d{4})/);

  if (publicationYearMatch) {
    return Number(publicationYearMatch[1]);
  }

  return NaN;
}

/**
 * Extracts the subject from a given list of items.
 * 
 * @param items - A list of items from which the subject is to be extracted.
 * 
 * @returns The extracted subject if it exists, 'Not available' otherwise.
 */
function extractSubjects(items: Item[] | undefined): string {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Not available';
  }
  const subjectData = extractItemData(items, 'Subject');
  return subjectData ? subjectData : 'Not available';
}

/**
 * Transforms a record into a display record.
 * 
 * @param record - The record to transform.
 * 
 * @returns A promise that resolves with the transformed display record.
 */
function extractLocationInformation(record: Record | undefined): { Sublocation: string; ShelfLocator: string }[] {
  let locationInformation: CopyInformation[] = [];

  if (Array.isArray(record?.Holdings)) {
    const firstHolding = record?.Holdings[0];
    const copyInformationList = firstHolding?.HoldingSimple.CopyInformationList;
    if (Array.isArray(copyInformationList)) {
      locationInformation = copyInformationList;
    }
  }
  return locationInformation ? locationInformation : [{ Sublocation: 'Not available', ShelfLocator: 'Not available' }];
}

/**
 * Transforms a raw Record object into a more user-friendly DisplayRecord object.
 * It extracts the necessary data from the raw record using various helper functions.
 *
 * @param record - The raw Record object to be transformed.
 *
 * @returns A Promise that resolves to a DisplayRecord object.
 */
async function transformToDisplayRecord(record: Record): Promise<DisplayRecord> {
  const items = record?.Items?.map((item: any) => item) || [];
  const title = extractItemData(items, 'Title');
  const author = extractItemData(items, 'Author');
  const publicationYear = extractPublicationYear(items);
  const bookType = record.Header?.PubType || 'Not available';
  const subjects = extractSubjects(items);
  const locationInformation = extractLocationInformation(record);
  const displayRecord: DisplayRecord = {
    title,
    author,
    publicationYear,
    bookType,
    subjects,
    locationInformation,
  };
  return displayRecord;
}

/**
 * Main function for querying the Ebsco API. This function performs a search with
 * the given parameters and transforms the resulting records into DisplayRecord objects.
 * In case of any error during the process, it returns a Left<Error> object.
 *
 * @param query - The query string for the Ebsco API search.
 * @param sessionToken - The session token used for authenticating with the Ebsco API.
 * @param numOfBooks - The number of books to return from the search.
 *
 * @returns A Promise that resolves to an Either<Error, DisplayRecord[]> object.
 */
async function queryEbscoApi(query: string, sessionToken: string, numOfBooks: number): Promise<Either<Error, DisplayRecord[]>> {
  const { userId, password, profile } = getEnvironmentVariables();

  const responseResult = await performSearch(sessionToken, query, numOfBooks);

  if (isLeft(responseResult)) {
    return responseResult;
  }

  const response: SearchResponse = responseResult.right;

  const dataPromises = response.SearchResult.Data.Records.map((record: Record) => {
    return transformToDisplayRecord(record);
  });
  let data: DisplayRecord[] = [];

  try {
    data = await Promise.all(dataPromises);
  } catch (error) {
    if (error instanceof Error) {
      return left(error);
    } else {
      return left(new Error('An unknown error occurred.'));
    }
  }
  await endSession(sessionToken);

  return right(data);
}

/**
 * Exposed function to search for a book using the Ebsco API. This function uses the 
 * queryEbscoApi function and processes its result to either return the list of found books
 * or throw an error.
 *
 * @param query - The query string for the Ebsco API search.
 * @param sessionToken - The session token used for authenticating with the Ebsco API.
 * @param numOfBooks - The number of books to return from the search.
 *
 * @returns A Promise that resolves to an array of DisplayRecord objects if successful, 
 *          or throws an Error if unsuccessful.
 */
export async function searchForBook(query: string, sessionToken: string, numOfBooks: number): Promise<DisplayRecord[]> {
  const dataResult = await queryEbscoApi(query, sessionToken, numOfBooks);
  if (isLeft(dataResult)) {
    console.error('Error querying the EBSCO API:', dataResult.left);
    throw new Error('No results found due to an error.');
  }

  const data: DisplayRecord[] = dataResult.right;

  if (data.length > 0) {
    return data;
  } else {
    throw new Error('No results found');
  }
}