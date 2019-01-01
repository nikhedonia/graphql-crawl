import express from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import superagent from 'superagent';
import cheerio from 'cheerio';
import Dataloader from 'dataloader';


// Let's cache all the responses
const urlLoader = new Dataloader(urls => Promise.all(urls.map(u=>superagent.get(u))));
const get = url => urlLoader.load(url)


const typeDefs = gql`
type Node {
  # get value of Node attribute
  attr(name: String): String
  text: String,
  # follow href
  follow: Html,
  # query children of node
  css(sel: String!, start: Int, end: Int) : [Node]
}

type Html {
  url: String
  # sel: css selector
  # start/end: optional parameters to array.slice to limit no. results
  css (sel: String!, start: Int, end: Int) : [Node]
}

type Query {
  # url: url to scrape
  # sel: css selector of the <a> that refers to the next page
  # count: how many pages to scrape
  # result: array of scraped pages
  paginate (url: String!, sel: String!, count: Int) : [Html]
  get(url: String!) : Html
}
`;

const css = ({url, $, node}, {sel, start, end}) => {
  const f = (start === undefined)
    ? x => x
    : x => x.slice(start, end === undefined ? x.length : end)

  return f(
    $(sel, node)
    .toArray()
    .map( (node, index) => ({$, index, url, node}))
  );
}


// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    get: (_, {url}) => get(url),
    paginate: async (_, {url, next, count=0}) => {
      let currentUrl = url;
      let i = 0;
      let pages = [currentUrl];
      while (count === 0 || i < count) {
        try {
          const {text} = await get(currentUrl);
          pages.push(currentUrl);
          const $ = cheerio.load(html.text);
          currentUrl = $(next).get(0).attr('href');
          ++i;
        } catch (_) {
          break;
        }
      }

      return pages
        .map(get);
    },
  },

  Node: {
    attr: ({$, node}, {name}) => $(node).attr(name),
    text: ({$, node}) => $(node).text(),
    follow: ({$, url, node}) => {
      const href = $(node).attr('href');
      const nextUrl =  (href.match("//")) ? href : (
        url + ((url.endsWith('/') || href.startsWith('/') || href.startsWith('.')) ? '' : '/') + href
      );

      return get(nextUrl);
    },
    css,
  },

  Html: {
    url: (html) => html.request.url,
    css: (html, x) => {
      try {
        const $ = cheerio.load(html.text);
        const url = html.request.url;
        const htmlNode = $('html').get(0);
        return css({$, url, node: htmlNode}, x);
      } catch (e) {
        // Not html...
        console.log(e);
        return;
      }
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

const app = express();
server.applyMiddleware({ app });

app.listen({ port: 4000 }, () =>
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
);
