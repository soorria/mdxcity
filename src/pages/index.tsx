import { type NextPage } from "next";
import Head from "next/head";

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>MDX City</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center text-center">
        MDX City. <br /> In Production.
      </main>
    </>
  );
};

export default Home;
