import express from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import superagent from 'superagent';
import cheerio from 'cheerio';
import Dataloader from 'dataloader';

// Construct a schema, using GraphQL schema language


const urlLoader = new Dataloader(urls => Promise.all(urls.map(u=>superagent.get(u))));

const get = url => urlLoader.load(url)


const typeDefs = gql`
  type Node {
    attr(name: String): String
    text: String,
    follow: Html,
    css(sel: String!, start: Int, end: Int) : [Node]
  }

  type Html {
    url: String
    css (sel: String!, start: Int, end: Int) : [Node]
  }

  type Query {
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
      const $ = cheerio.load(html.text);
      const url = html.request.url;
      return css({$, url, node:$('html').get(0)}, x);
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

const app = express();
server.applyMiddleware({ app });

app.listen({ port: 4000 }, () =>
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
);
