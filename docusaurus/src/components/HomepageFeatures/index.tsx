import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Build Online Visibility',
    description: (
      <>
        Help your clients get found everywhere prospects search by managing their business listings, reviews, and Google Business Profile.
      </>
    ),
  },
  {
    title: 'Drive & Optimize Conversions',
    description: (
      <>
        Make it easy to connect with new customers at every step of their journey with advertising tools and AI-powered messaging.
      </>
    ),
  },
  {
    title: 'Automated Reporting & Insights',
    description: (
      <>
        Utilize powerful reporting that empowers your business to sell more with insights on business listing accuracy and competitive intel.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
